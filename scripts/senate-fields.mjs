export function senateFields(source) {
  const out = {};
  const keys = ["senate_status", "senate_last_good_date", "senate_handoff_date"];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (source && Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  }
  return out;
}
