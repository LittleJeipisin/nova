export function getWorkspaceSlugFromPath(
  pathname: string =
    window.location.pathname,
) {
  const segments =
    pathname
      .split('/')
      .map(
        (
          segment,
        ) =>
          segment.trim(),
      )
      .filter(
        Boolean,
      );

  if (
    segments.length ===
    0
  ) {
    return null;
  }

  try {
    const slug =
      decodeURIComponent(
        segments[0],
      )
        .trim()
        .toLowerCase();

    return (
      slug ||
      null
    );
  } catch {
    return null;
  }
}

export function getWorkspacePath(
  workspaceSlug: string,
) {
  const cleanSlug =
    workspaceSlug
      .trim()
      .toLowerCase();

  if (
    !cleanSlug
  ) {
    return '/';
  }

  return `/${encodeURIComponent(
    cleanSlug,
  )}`;
}