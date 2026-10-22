// Shared helpers for saree-type / care-instruction tag options.
// `call(url, body)` is the page's authedFetch.
export const TAG_FN = "https://mgmgkwoxirvzdnmayhwq.supabase.co/functions/v1/admin-manage-tag-options";

export const KINDS = {
  saree_type: { label: "Saree type", plural: "Saree types" },
  care_instruction: { label: "Care instruction", plural: "Care instructions" },
};

export async function listTagOptions(call, kind, includeInactive = false) {
  const r = await call(TAG_FN, { action: "list", kind, include_inactive: includeInactive });
  return (r.rows || []).slice().sort((a, b) =>
    (a.display_order ?? 0) - (b.display_order ?? 0) || String(a.name).localeCompare(String(b.name)));
}

export async function createTagOption(call, kind, fields) {
  const r = await call(TAG_FN, { action: "create", kind, ...fields });
  return r.row;
}

export async function updateTagOption(call, kind, id, patch) {
  const r = await call(TAG_FN, { action: "update", kind, id, ...patch });
  return r.row;
}

export async function deleteTagOption(call, kind, id) {
  await call(TAG_FN, { action: "delete", kind, id });
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Fill a <select> with options; `selectedId` is kept even if inactive/missing.
// withAddNew appends a "+ Add new ..." option whose value is "__new__".
export function fillSelect(sel, rows, selectedId, { addNewLabel } = {}) {
  let html = '<option value="">— None —</option>' +
    rows.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.name) + (r.is_active === false ? " (inactive)" : "") + "</option>").join("");
  if (addNewLabel) html += '<option value="__new__">' + esc(addNewLabel) + "</option>";
  sel.innerHTML = html;
  sel.value = selectedId || "";
  if (sel.value !== (selectedId || "")) sel.value = "";
}
