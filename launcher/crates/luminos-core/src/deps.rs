//! Mod dependency graph for the mods page: what requires what, what is missing, and whether a mod can be switched off.
//! Pure data in, pure data out. Nodes are keyed by an opaque id (Modrinth project id in practice), so the same code works
//! for jar metadata later.
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ModNode {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    /// Ids this mod needs (Modrinth `dependency_type == "required"`).
    pub requires: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Missing {
    pub mod_id: String,
    pub needs: String,
}

#[derive(Default, Clone, Debug)]
pub struct Graph {
    nodes: BTreeMap<String, ModNode>,
}

impl Graph {
    pub fn new(nodes: impl IntoIterator<Item = ModNode>) -> Self {
        Graph {
            nodes: nodes.into_iter().map(|n| (n.id.clone(), n)).collect(),
        }
    }
    pub fn get(&self, id: &str) -> Option<&ModNode> {
        self.nodes.get(id)
    }

    /// Enabled mods that need something that is not installed at all, or is installed but switched off.
    pub fn missing(&self) -> Vec<Missing> {
        let mut out = vec![];
        for n in self.nodes.values().filter(|n| n.enabled) {
            for r in &n.requires {
                if !self.nodes.get(r).is_some_and(|d| d.enabled) {
                    out.push(Missing {
                        mod_id: n.id.clone(),
                        needs: r.clone(),
                    });
                }
            }
        }
        out
    }

    /// Enabled mods that directly require `id`.
    pub fn required_by(&self, id: &str) -> Vec<String> {
        self.nodes
            .values()
            .filter(|n| n.enabled && n.requires.iter().any(|r| r == id))
            .map(|n| n.id.clone())
            .collect()
    }

    /// `Ok` if nothing enabled needs it; otherwise the names of the mods that do (the UI blocks the switch and shows these).
    pub fn can_disable(&self, id: &str) -> Result<(), Vec<String>> {
        let by = self.required_by(id);
        if by.is_empty() {
            Ok(())
        } else {
            Err(by
                .iter()
                .map(|i| self.nodes.get(i).map_or(i.clone(), |n| n.name.clone()))
                .collect())
        }
    }

    /// Everything that must also be switched off to switch `id` off: its enabled dependants, transitively. Cycle-safe. Sorted.
    pub fn disable_closure(&self, id: &str) -> Vec<String> {
        let mut seen = BTreeSet::new();
        let mut stack = vec![id.to_string()];
        while let Some(cur) = stack.pop() {
            for d in self.required_by(&cur) {
                if d != id && seen.insert(d.clone()) {
                    stack.push(d);
                }
            }
        }
        seen.into_iter().collect()
    }

    /// Everything that must also be switched on to switch `id` on: required mods that are installed but off, transitively.
    /// Required mods that are not installed come back in `.1` (the store has to download them).
    pub fn enable_closure(&self, id: &str) -> (Vec<String>, Vec<String>) {
        let (mut on, mut absent) = (BTreeSet::new(), BTreeSet::new());
        let mut seen = BTreeSet::from([id.to_string()]);
        let mut stack = vec![id.to_string()];
        while let Some(cur) = stack.pop() {
            let Some(n) = self.nodes.get(&cur) else {
                continue;
            };
            for r in &n.requires {
                match self.nodes.get(r) {
                    None => {
                        absent.insert(r.clone());
                    }
                    Some(d) => {
                        if !d.enabled {
                            on.insert(r.clone());
                        }
                        if seen.insert(r.clone()) {
                            stack.push(r.clone());
                        }
                    }
                }
            }
        }
        (on.into_iter().collect(), absent.into_iter().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn n(id: &str, on: bool, req: &[&str]) -> ModNode {
        ModNode {
            id: id.into(),
            name: id.to_uppercase(),
            enabled: on,
            requires: req.iter().map(|s| s.to_string()).collect(),
        }
    }
    fn g() -> Graph {
        // iris -> sodium -> (nothing);  lithium-extras -> lithium (installed, off);  fancy -> ghostlib (not installed)
        Graph::new([
            n("sodium", true, &[]),
            n("iris", true, &["sodium"]),
            n("lithium", false, &[]),
            n("extras", true, &["lithium"]),
            n("fancy", true, &["ghostlib"]),
        ])
    }
    #[test]
    fn missing_counts_absent_and_switched_off() {
        let m = g().missing();
        assert!(m.contains(&Missing {
            mod_id: "extras".into(),
            needs: "lithium".into()
        }));
        assert!(m.contains(&Missing {
            mod_id: "fancy".into(),
            needs: "ghostlib".into()
        }));
        assert_eq!(m.len(), 2);
    }
    #[test]
    fn cannot_disable_what_an_enabled_mod_needs() {
        assert_eq!(g().can_disable("sodium"), Err(vec!["IRIS".to_string()]));
        assert_eq!(g().can_disable("iris"), Ok(()));
    }
    #[test]
    fn disabled_dependants_do_not_block() {
        let gr = Graph::new([n("a", true, &[]), n("b", false, &["a"])]);
        assert_eq!(gr.can_disable("a"), Ok(()));
    }
    #[test]
    fn closures_follow_chains_and_survive_cycles() {
        let gr = Graph::new([
            n("a", true, &[]),
            n("b", true, &["a"]),
            n("c", true, &["b"]),
        ]);
        assert_eq!(gr.disable_closure("a"), vec!["b", "c"]);
        let cyc = Graph::new([n("x", true, &["y"]), n("y", true, &["x"])]);
        assert_eq!(cyc.disable_closure("x"), vec!["y"]);
        let off = Graph::new([
            n("a", false, &[]),
            n("b", false, &["a"]),
            n("c", false, &["b", "zz"]),
        ]);
        assert_eq!(
            off.enable_closure("c"),
            (
                vec!["a".to_string(), "b".to_string()],
                vec!["zz".to_string()]
            )
        );
    }
}
