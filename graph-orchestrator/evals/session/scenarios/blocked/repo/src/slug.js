// slugify("Hello, World!") === "hello-world"
export function slugify(text, { separator = "-" } = {}) {
  if (typeof text !== "string") throw new TypeError("slugify: text must be a string");
  if (separator.length !== 1) throw new RangeError("slugify: separator must be one character");
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}|${separator}$`), ""); // bug: strips only one end
}

export function isSlug(text) {
  return typeof text === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(text);
}
