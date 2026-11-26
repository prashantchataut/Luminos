//! JVM heap sizing that cannot crash the JVM at start-up.
//!
//! Why this exists: `hs_err_pid*.log` "os::commit_memory ... (mmap) failed" on Windows happens when the JVM is asked to commit more
//! memory than the OS can back right now. Two things caused it in 4.0/4.1: `AlwaysPreTouch` (commits the whole heap at launch)
//! and a requested `-Xmx` that was larger than the RAM that was actually free. Both are gone:
//!
//! * `-Xms` is a fixed, small [`XMS_MB`] (never equal to `-Xmx`).
//! * `-Xmx` is the requested value, capped at [`FREE_RAM_FRACTION`] of the memory that is *available right now*, then clamped to
//!   [`MIN_XMX_MB`]..=[`MAX_XMX_MB`].
//!
//! No new dependency: Windows uses `GlobalMemoryStatusEx` (kernel32, declared by hand), Linux reads `/proc/meminfo`,
//! macOS parses `vm_stat`. When the probe fails the answer is `None` and the default [`DEFAULT_XMX_MB`] is used.

/// Initial heap. Small on purpose: the heap grows on demand instead of being committed up front.
pub const XMS_MB: u32 = 512;
/// What the game gets when nothing was requested or the free-RAM probe fails.
pub const DEFAULT_XMX_MB: u32 = 2048;
pub const MIN_XMX_MB: u32 = 1024;
pub const MAX_XMX_MB: u32 = 3072;
/// Share of the currently free physical memory the heap may claim.
pub const FREE_RAM_FRACTION: f64 = 0.55;

/// `-Xmx` in MiB for a request, given the memory available right now (`None` = unknown).
pub fn safe_xmx_mb(requested_mb: u32, available_mb: Option<u64>) -> u32 {
    let safe_max = match available_mb {
        Some(a) => ((a as f64) * FREE_RAM_FRACTION) as u32,
        None => DEFAULT_XMX_MB,
    };
    requested_mb.min(safe_max).clamp(MIN_XMX_MB, MAX_XMX_MB)
}

/// The two heap arguments for a launch: `-Xms512M` and the clamped `-Xmx`. Probes free memory *now*.
pub fn heap_args(requested_mb: u32) -> (String, String, u32) {
    let avail = available_memory_mb();
    let xmx = safe_xmx_mb(requested_mb, avail);
    (format!("-Xms{XMS_MB}M"), format!("-Xmx{xmx}M"), xmx)
}

/// Physical memory that is free *right now* (what the OS can hand out without paging), in MiB.
pub fn available_memory_mb() -> Option<u64> {
    imp::available_mb()
}

#[cfg(windows)]
mod imp {
    #[repr(C)]
    struct MemoryStatusEx {
        length: u32,
        memory_load: u32,
        total_phys: u64,
        avail_phys: u64,
        total_page_file: u64,
        avail_page_file: u64,
        total_virtual: u64,
        avail_virtual: u64,
        avail_extended_virtual: u64,
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(buf: *mut MemoryStatusEx) -> i32;
    }
    pub fn available_mb() -> Option<u64> {
        let mut m = MemoryStatusEx {
            length: std::mem::size_of::<MemoryStatusEx>() as u32,
            memory_load: 0,
            total_phys: 0,
            avail_phys: 0,
            total_page_file: 0,
            avail_page_file: 0,
            total_virtual: 0,
            avail_virtual: 0,
            avail_extended_virtual: 0,
        };
        // SAFETY: `m` is a correctly sized, initialised MEMORYSTATUSEX with `length` set, as the API requires.
        let ok = unsafe { GlobalMemoryStatusEx(&mut m) };
        // The commit limit matters on Windows: the JVM fails when the page file cannot back the heap, so take the smaller of the two.
        (ok != 0).then(|| m.avail_phys.min(m.avail_page_file) / (1024 * 1024))
    }
}

#[cfg(target_os = "linux")]
mod imp {
    pub fn available_mb() -> Option<u64> {
        parse_meminfo(&std::fs::read_to_string("/proc/meminfo").ok()?)
    }
    pub(super) fn parse_meminfo(s: &str) -> Option<u64> {
        let kb = s.lines().find_map(|l| l.strip_prefix("MemAvailable:"))?;
        let kb: u64 = kb.trim().trim_end_matches("kB").trim().parse().ok()?;
        Some(kb / 1024)
    }
}

#[cfg(target_os = "macos")]
mod imp {
    pub fn available_mb() -> Option<u64> {
        let mut c = std::process::Command::new("vm_stat");
        crate::sys::quiet(&mut c);
        let out = String::from_utf8(c.output().ok()?.stdout).ok()?;
        let page: u64 = out
            .lines()
            .next()?
            .split("page size of")
            .nth(1)?
            .split_whitespace()
            .next()?
            .parse()
            .ok()?;
        let pages = |key: &str| -> u64 {
            out.lines()
                .find(|l| l.starts_with(key))
                .and_then(|l| l.split(':').nth(1))
                .and_then(|v| v.trim().trim_end_matches('.').parse().ok())
                .unwrap_or(0)
        };
        Some(
            (pages("Pages free") + pages("Pages inactive") + pages("Pages speculative")) * page
                / (1024 * 1024),
        )
    }
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
mod imp {
    pub fn available_mb() -> Option<u64> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xmx_is_55_percent_of_free_ram_and_clamped() {
        // 8 GB free, user asks 6 GB: 55% of 8192 = 4505, then the 3072 ceiling applies.
        assert_eq!(safe_xmx_mb(6144, Some(8192)), 3072);
        // 4 GB free, user asks 3 GB: 55% of 4096 = 2252.
        assert_eq!(safe_xmx_mb(3072, Some(4096)), 2252);
        // almost nothing free: never below the 1 GB floor Minecraft needs.
        assert_eq!(safe_xmx_mb(2048, Some(900)), 1024);
        // a small request stays small
        assert_eq!(safe_xmx_mb(1536, Some(16000)), 1536);
    }

    #[test]
    fn unknown_free_ram_uses_the_safe_default() {
        assert_eq!(safe_xmx_mb(4096, None), DEFAULT_XMX_MB);
        assert_eq!(safe_xmx_mb(1024, None), 1024);
    }

    #[test]
    fn xms_is_never_equal_to_xmx() {
        for req in [512, 1024, 2048, 4096, 16384] {
            for avail in [None, Some(500), Some(4096), Some(65536)] {
                assert!(
                    XMS_MB < safe_xmx_mb(req, avail),
                    "Xms must stay below Xmx (req {req}, avail {avail:?})"
                );
            }
        }
    }

    #[test]
    fn heap_args_never_pretouch() {
        let (xms, xmx, mb) = heap_args(4096);
        assert_eq!(xms, "-Xms512M");
        assert_eq!(xmx, format!("-Xmx{mb}M"));
        assert!((MIN_XMX_MB..=MAX_XMX_MB).contains(&mb));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn parses_meminfo() {
        let s = "MemTotal:       16384000 kB\nMemFree:          100000 kB\nMemAvailable:    8192000 kB\n";
        assert_eq!(imp::parse_meminfo(s), Some(8000));
        assert_eq!(imp::parse_meminfo("MemTotal: 1 kB\n"), None);
        assert!(available_memory_mb().is_some());
    }
}
