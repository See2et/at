module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "domain-only-domain",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { pathNot: "^(src/domain/|node_modules/neverthrow/)" },
    },
    {
      name: "application-only-application-or-domain",
      severity: "error",
      from: { path: "^src/application/" },
      to: { pathNot: "^(src/(application|domain)/|node_modules/neverthrow/)" },
    },
    {
      name: "callers-use-public-index",
      severity: "error",
      from: { pathNot: "^src/" },
      to: { path: "^src/", pathNot: "^src/index\\.ts$" },
    },
    {
      name: "core-platform-independent",
      severity: "error",
      from: { path: "^src/" },
      to: { pathNot: "^(src/|node_modules/neverthrow/)" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(\\.astraeus|\\.stryker-tmp|reports|coverage|\\.husky)/" },
  },
};
