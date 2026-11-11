// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findBlocks } from "../src/core/segment";

const long = (s: string) => `${s} `.repeat(20).trim();

describe("findBlocks", () => {
  it("returns each job card, not the list around them", () => {
    document.body.innerHTML = `
      <nav>${long("menu item")}</nav>
      <ul id="jobs">
        <li id="a"><h3>Sales rep</h3><p>${long("commission only")}</p></li>
        <li id="b"><h3>Engineer</h3><p>${long("salary and benefits")}</p></li>
      </ul>`;
    const ids = findBlocks(document.body).map((b) => b.el.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("reads an email with several long paragraphs as one block", () => {
    document.body.innerHTML = `<div id="mail"><p>${long("first paragraph")}</p><p>${long("second paragraph")}</p></div>`;
    const blocks = findBlocks(document.body);
    expect(blocks.map((b) => b.el.id)).toEqual(["mail"]);
    expect(blocks[0].text).toContain("second paragraph");
  });

  it("ignores navigation, forms, its own UI and tiny text", () => {
    document.body.innerHTML = `
      <footer><div>${long("footer text")}</div></footer>
      <form><div>${long("form text")}</div></form>
      <div data-cantrip-ui><div>${long("badge text")}</div></div>
      <div>short</div>`;
    expect(findBlocks(document.body)).toEqual([]);
  });

  it("caps the number of blocks", () => {
    document.body.innerHTML = Array.from({ length: 60 }, (_, i) => `<article id="x${i}">${long("post body")}</article>`).join("");
    expect(findBlocks(document.body, 10)).toHaveLength(10);
  });
});
