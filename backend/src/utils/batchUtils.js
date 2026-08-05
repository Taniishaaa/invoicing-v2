export function buildBatchNumber(batch) {

  if (!batch)
    return "-";

  const date = new Date(batch.createdAt);

  return `B-${
    date.getFullYear()
  }${
    String(date.getMonth() + 1).padStart(2, "0")
  }${
    String(date.getDate()).padStart(2, "0")
  }-${
    batch.id.slice(-6).toUpperCase()
  }`;

}