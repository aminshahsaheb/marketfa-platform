import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("web shell starts in Persian RTL presentation", async () => { const html = await readFile(new URL("../index.html", import.meta.url), "utf8"); assert.match(html, /lang="fa" dir="rtl"/); });
