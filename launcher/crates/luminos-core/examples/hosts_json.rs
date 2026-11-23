//! Prints the network host registry as JSON. Used to generate the website's /privacy data:
//! `cargo run -q -p luminos-core --example hosts_json > site/src/lib/hosts.json`
fn main() {
    print!("{}", luminos_core::netaudit::registry_json());
}
