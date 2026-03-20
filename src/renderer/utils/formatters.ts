export const formatPath = (fullPath: string) => {
  if (fullPath.length <= 40) return fullPath;
  const parts = fullPath.split("/");
  if (parts.length <= 2)
    return fullPath.slice(0, 15) + "..." + fullPath.slice(-15);
  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
};

export const formatBytes = (mb: number | undefined, fixed: boolean = false) => {
  if (!mb) return "0 MB";
  const isNegative = mb < 0;
  const absMb = Math.abs(mb);

  const formatted = (() => {
    const rawBytes = absMb * 1024 * 1024;
    if (!fixed) {
      if (rawBytes >= 1000 * 1000 * 1000)
        return `${parseFloat((rawBytes / 1e9).toFixed(2))} GB`;
      if (rawBytes >= 1000 * 1000)
        return `${parseFloat((rawBytes / 1e6).toFixed(1))} MB`;
      if (rawBytes >= 1000)
        return `${parseFloat((rawBytes / 1e3).toFixed(0))} KB`;
      return `${rawBytes.toFixed(0)} B`;
    }
    if (rawBytes >= 999.995 * 1000 * 1000)
      return `${(rawBytes / 1e9).toFixed(2)} GB`;
    if (rawBytes >= 999.995 * 1000) return `${(rawBytes / 1e6).toFixed(2)} MB`;
    if (rawBytes >= 999.995) return `${(rawBytes / 1e3).toFixed(2)} KB`;
    return `${rawBytes.toFixed(0)} B`;
  })();

  return isNegative ? `-${formatted}` : formatted;
};

export const formatCompactNumber = (num: number | undefined) => {
  if (num === undefined) return "0";
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};
