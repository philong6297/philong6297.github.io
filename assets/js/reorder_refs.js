
document.addEventListener('DOMContentLoaded', (event) => {
  let refHeading = document.body.querySelector("h1[id$='-references']");
  let ref = document.body.querySelector("div#refs.references");

  if (ref === null || refHeading === null) {
    return;
  }

  let parent = ref.parentElement;

  // detach from DOM
  ref = parent.removeChild(ref);
  refHeading = parent.removeChild(refHeading);

  let footnotes = document.body.querySelector("div.footnotes[role='doc-endnotes']");
  if (footnotes !== null) {
    parent = footnotes.parentElement;
    footnotes.id = "footnotes";
    footnotes.removeChild(footnotes.querySelector("hr"));
  }

  // add to parent
  let refContainer = document.createElement("div");
  refContainer.className = "footnotes";
  refContainer.id = "refs-container";
  refContainer.setAttribute("role", "doc-endnotes");
  refContainer.appendChild(refHeading);
  refContainer.appendChild(ref);

  parent.appendChild(refContainer);
});
