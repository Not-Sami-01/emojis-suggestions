use gtk::gdk;
use gtk::prelude::*;
use gtk::{Application, ApplicationWindow, Button, Entry, FlowBox, Label, Orientation};
use serde::Deserialize;
use std::process::Command;
use std::rc::Rc;
use std::time::Duration;

const EMOJI_DATA: &str = include_str!("../../data/emojis.json");
const DEFAULTS: &[&str] = &[
    "😀", "😂", "🤣", "🥰", "😍", "😎", "🤔", "😅", "😭", "😡", "👍", "👏", "🙏", "💪", "🔥", "❤️",
    "🎉", "✨", "💯", "🚀", "🍕", "☕", "🐱", "🐶",
];

#[derive(Clone, Deserialize)]
struct Emoji {
    c: String,
    n: String,
    k: Vec<String>,
}

fn search(entries: &[Emoji], query: &str) -> Vec<Emoji> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return DEFAULTS
            .iter()
            .filter_map(|value| entries.iter().find(|item| item.c == *value).cloned())
            .take(12)
            .collect();
    }

    let mut hits: Vec<(usize, usize, Emoji)> = entries
        .iter()
        .enumerate()
        .filter_map(|(index, item)| {
            let tone = item.c.chars().any(|ch| ('🏻'..='🏿').contains(&ch));
            let score = if item.n == q {
                0
            } else if item.n.starts_with(&q) {
                1
            } else if item.k.iter().any(|keyword| keyword == &q) {
                2
            } else if item.k.iter().any(|keyword| keyword.starts_with(&q)) {
                3
            } else if item.n.contains(&q) {
                4
            } else if item.k.iter().any(|keyword| keyword.contains(&q)) {
                5
            } else {
                return None;
            };
            Some((score + usize::from(tone), index, item.clone()))
        })
        .collect();
    hits.sort_by_key(|(score, index, _)| (*score, *index));
    hits.into_iter().take(12).map(|(_, _, item)| item).collect()
}

fn main() {
    let entries: Vec<Emoji> =
        serde_json::from_str(EMOJI_DATA).expect("emoji database is valid JSON");
    let app = Application::builder()
        .application_id("io.github.not-sami-01.emoji-suggestions-native")
        .build();

    app.connect_activate(move |app| build_window(app, Rc::new(entries.clone())));
    app.run();
}

fn build_window(app: &Application, entries: Rc<Vec<Emoji>>) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Emoji Suggestions · Native")
        .default_width(700)
        .default_height(210)
        .resizable(false)
        .build();

    let root = gtk::Box::new(Orientation::Vertical, 12);
    root.set_margin_top(18);
    root.set_margin_bottom(18);
    root.set_margin_start(20);
    root.set_margin_end(20);

    let heading = Label::builder()
        .label("Emoji Suggestions")
        .xalign(0.0)
        .css_classes(["title-2"])
        .build();
    root.append(&heading);

    let query_entry = Entry::builder()
        .placeholder_text("Search by name or meaning…")
        .hexpand(true)
        .build();
    root.append(&query_entry);

    let results = FlowBox::builder()
        .selection_mode(gtk::SelectionMode::None)
        .max_children_per_line(12)
        .min_children_per_line(6)
        .column_spacing(6)
        .row_spacing(6)
        .homogeneous(true)
        .build();
    root.append(&results);

    let status = Label::builder()
        .label("Choose an emoji to copy and paste it.")
        .xalign(0.0)
        .css_classes(["dim-label"])
        .build();
    root.append(&status);
    window.set_child(Some(&root));

    let render = {
        let results = results.clone();
        let status = status.clone();
        let window = window.clone();
        let entries = entries.clone();
        move |query: &str| {
            while let Some(child) = results.first_child() {
                results.remove(&child);
            }
            let matches = search(&entries, query);
            if matches.is_empty() {
                status.set_text("No matching emoji found.");
                return;
            }
            status.set_text(&format!(
                "{} suggestions · Enter a word to narrow the list",
                matches.len()
            ));
            for item in matches {
                let button = Button::with_label(&item.c);
                button.set_tooltip_text(Some(&item.n));
                button.add_css_class("emoji-chip");
                let emoji = item.c.clone();
                let window = window.clone();
                button.connect_clicked(move |_| {
                    if let Some(display) = gdk::Display::default() {
                        display.clipboard().set_text(&emoji);
                        window.set_visible(false);
                        gtk::glib::timeout_add_local_once(Duration::from_millis(180), || {
                            let _ = Command::new("ydotool")
                                .args(["key", "29:1", "47:1", "47:0", "29:0"])
                                .spawn();
                        });
                    }
                });
                results.insert(&button, -1);
            }
        }
    };

    let first_render = render.clone();
    first_render("");
    query_entry.connect_changed(move |entry| render(&entry.text()));

    let css = gtk::CssProvider::new();
    css.load_from_data(
        "window { background: #171b24; color: #f1f3f8; } entry { padding: 10px 12px; border-radius: 13px; } .emoji-chip { min-width: 42px; min-height: 42px; font-size: 25px; border-radius: 13px; background: alpha(white, 0.09); } .emoji-chip:hover { background: alpha(#8bc9ff, 0.24); }",
    );
    if let Some(display) = gdk::Display::default() {
        gtk::style_context_add_provider_for_display(
            &display,
            &css,
            gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }

    window.present();
    query_entry.grab_focus();
}
