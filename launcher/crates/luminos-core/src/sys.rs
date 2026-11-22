//! Small OS helpers.
//!
//! * [`quiet`] – on Windows a GUI program that spawns a console program (like `java.exe`) makes Windows
//!   pop a console window open for every child. Probing several Java installs therefore looked like the
//!   launcher was "opening a terminal 8-10 times". Every child process now goes through [`quiet`].
//! * [`SingleInstance`] – only one launcher window per data folder.
use std::{
    fs::{File, OpenOptions},
    process::Command,
};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Prevent a console window from appearing for this child process (no-op on other platforms).
pub fn quiet(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Holds an exclusive lock on `<data>/luminos.lock` for as long as it lives.
pub struct SingleInstance {
    _file: File,
}

impl SingleInstance {
    /// `None` means another launcher already owns the lock.
    pub fn acquire() -> Option<SingleInstance> {
        let root = crate::paths::root();
        let _ = std::fs::create_dir_all(&root);
        let file = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(root.join("luminos.lock"))
            .ok()?;
        match file.try_lock() {
            Ok(()) => Some(SingleInstance { _file: file }),
            Err(std::fs::TryLockError::WouldBlock) => None,
            // Filesystems without lock support: don't block the user from starting.
            Err(_) => Some(SingleInstance { _file: file }),
        }
    }
}
