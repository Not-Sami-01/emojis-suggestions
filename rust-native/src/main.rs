use gtk::gdk;
use gtk::prelude::*;
use gtk::{
    Application, ApplicationWindow, Button, Entry, Label, Orientation, PolicyType, ScrolledWindow,
};
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
        .default_height(164)
        .resizable(false)
        .decorated(false)
        .build();

    let root = gtk::Box::new(Orientation::Vertical, 10);
    root.add_css_class("surface");
    root.set_margin_top(10);
    root.set_margin_bottom(10);
    root.set_margin_start(12);
    root.set_margin_end(12);

    let top = gtk::Box::new(Orientation::Horizontal, 12);
    top.set_valign(gtk::Align::Center);
    let heading = Label::builder()
        .label("emoji")
        .xalign(0.0)
        .css_classes(["brand"])
        .build();
    top.append(&heading);

    let query_entry = Entry::builder()
        .placeholder_text("Search emoji…")
        .hexpand(true)
        .css_classes(["search-entry"])
        .build();
    top.append(&query_entry);
    root.append(&top);

    let results = gtk::Box::new(Orientation::Horizontal, 7);
    results.set_valign(gtk::Align::Center);
    let scroller = ScrolledWindow::builder()
        .hscrollbar_policy(PolicyType::Never)
        .vscrollbar_policy(PolicyType::Never)
        .hexpand(true)
        .child(&results)
        .build();
    scroller.set_height_request(52);
    root.append(&scroller);

    let status = Label::builder()
        .label("Type to search · choose an emoji to paste")
        .xalign(0.0)
        .css_classes(["hint"])
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
            status.set_text(&format!("{} matches", matches.len()));
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
                results.append(&button);
            }
        }
    };

    let first_render = render.clone();
    first_render("");
    query_entry.connect_changed(move |entry| render(&entry.text()));

    let css = gtk::CssProvider::new();
    css.load_from_data(
        "window { background: #121620; color: #f3f5f9; } .surface { padding: 9px 13px; border: 1px solid alpha(#b8d8ff, .21); border-radius: 22px; background: linear-gradient(125deg, alpha(#62b8ff, .17), alpha(#171d2a, .96) 38%, alpha(#9878ed, .14)); } .brand { color: alpha(white, .84); font-size: 16px; font-weight: 650; letter-spacing: -1px; padding: 0 4px; } .search-entry { min-height: 38px; padding: 0 12px; border: 1px solid alpha(white, .10); border-radius: 13px; background: alpha(white, .055); color: #f5f7fc; } .search-entry:focus { border-color: alpha(#8bc9ff, .75); } .emoji-chip { min-width: 46px; min-height: 44px; padding: 0; font-size: 25px; border: 1px solid alpha(white, .075); border-radius: 14px; background: alpha(white, .07); transition: 180ms ease; } .emoji-chip:hover { background: alpha(#8bc9ff, .22); border-color: alpha(#b7e0ff, .4); } .hint { color: alpha(white, .47); font-size: 11px; padding-left: 3px; } scrollbar { opacity: 0; }",
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
