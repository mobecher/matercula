/**
 * Tests für `dokumentInhaltFuerAi` und `htmlToPlainText`.
 *
 * Es wird kein echtes Netz angesprochen – die Helper akzeptieren
 * Injection-Points (`fetchPageImpl`, `fetchYoutubeMetaImpl`).
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { dokumentInhaltFuerAi } from "../../lib/curriculum/dokument-inhalt";
import { htmlToPlainText } from "../../lib/web/fetch-page";

describe("htmlToPlainText", () => {
  it("strips scripts, styles and tags and collapses whitespace", () => {
    const html = `
      <html><head><title>x</title><style>p{}</style></head>
      <body>
        <script>alert(1)</script>
        <h1>Headline</h1>
        <p>Hello   <b>world</b>!</p>
      </body></html>`;
    const out = htmlToPlainText(html);
    assert.match(out, /Headline/);
    assert.match(out, /Hello\s+world\s*!/);
    assert.doesNotMatch(out, /alert\(1\)/);
    assert.doesNotMatch(out, /<\w+/);
  });

  it("decodes HTML entities", () => {
    const out = htmlToPlainText("<p>A &amp; B &#8211; C</p>");
    assert.equal(out, "A & B – C");
  });

  it("respects the byte cap", () => {
    const long = `<p>${"a".repeat(10_000)}</p>`;
    const out = htmlToPlainText(long, 100);
    assert.ok(out.length <= 101); // +1 for ellipsis
    assert.match(out, /…$/);
  });
});

describe("dokumentInhaltFuerAi", () => {
  it("returns legacy markdown content unchanged", async () => {
    const md = "# Titel\n\nAbsatz mit Text.";
    assert.equal(await dokumentInhaltFuerAi(md), md);
  });

  it("returns empty string for empty/null input", async () => {
    assert.equal(await dokumentInhaltFuerAi(null), "");
    assert.equal(await dokumentInhaltFuerAi(""), "");
    assert.equal(await dokumentInhaltFuerAi("   "), "");
  });

  it("walks BlockNote JSON and extracts inline text", async () => {
    const blocks = [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Lehrplan-Notizen" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Erste Zeile " },
          { type: "text", text: "mit Fortsetzung." },
        ],
      },
    ];
    const out = await dokumentInhaltFuerAi(JSON.stringify(blocks));
    assert.match(out, /Lehrplan-Notizen/);
    assert.match(out, /Erste Zeile mit Fortsetzung\./);
  });

  it("inlines link card content from the injected fetcher", async () => {
    const blocks = [
      {
        type: "linkCard",
        props: {
          url: "https://example.com/article",
          title: "Cached Title",
          description: "Cached Description",
        },
      },
    ];
    const out = await dokumentInhaltFuerAi(JSON.stringify(blocks), {
      fetchPageImpl: async () => ({
        url: "https://example.com/article",
        title: "Live Title",
        description: "Live Description",
        image: null,
        siteName: null,
        html: "<html><body><p>Article body text.</p></body></html>",
      }),
      fetchYoutubeMetaImpl: async () => null,
    });
    assert.match(out, /Live Title/);
    assert.match(out, /https:\/\/example\.com\/article/);
    assert.match(out, /Live Description/);
    assert.match(out, /Article body text\./);
  });

  it("falls back to cached link-card props when the fetcher fails", async () => {
    const blocks = [
      {
        type: "linkCard",
        props: {
          url: "https://example.com/x",
          title: "Cached",
          description: "Backup desc",
        },
      },
    ];
    const out = await dokumentInhaltFuerAi(JSON.stringify(blocks), {
      fetchPageImpl: async () => {
        throw new Error("boom");
      },
      fetchYoutubeMetaImpl: async () => null,
    });
    assert.match(out, /Cached/);
    assert.match(out, /Backup desc/);
  });

  it("inlines YouTube oEmbed metadata", async () => {
    const blocks = [
      {
        type: "youtubeEmbed",
        props: { url: "https://youtu.be/dQw4w9WgXcQ", videoId: "dQw4w9WgXcQ" },
      },
    ];
    const out = await dokumentInhaltFuerAi(JSON.stringify(blocks), {
      fetchPageImpl: async () => {
        throw new Error("should not fetch");
      },
      fetchYoutubeMetaImpl: async () => ({
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Never Gonna",
        authorName: "Rick Astley",
      }),
    });
    assert.match(out, /YouTube-Video/);
    assert.match(out, /Never Gonna/);
    assert.match(out, /Rick Astley/);
  });

  it("does not perform external fetches when fetchExternals is false", async () => {
    const blocks = [
      {
        type: "linkCard",
        props: { url: "https://example.com", title: "T", description: "D" },
      },
      {
        type: "youtubeEmbed",
        props: { url: "https://youtu.be/dQw4w9WgXcQ" },
      },
    ];
    let called = false;
    const out = await dokumentInhaltFuerAi(JSON.stringify(blocks), {
      fetchExternals: false,
      fetchPageImpl: async () => {
        called = true;
        throw new Error("no");
      },
      fetchYoutubeMetaImpl: async () => {
        called = true;
        return null;
      },
    });
    assert.equal(called, false);
    assert.match(out, /T/);
    assert.match(out, /youtu\.be/);
  });

  it("returns raw text on broken JSON", async () => {
    const broken = "[not json";
    const out = await dokumentInhaltFuerAi(broken);
    assert.equal(out, broken);
  });
});
