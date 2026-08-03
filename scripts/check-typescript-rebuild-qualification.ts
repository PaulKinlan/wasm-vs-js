const statusPath = "benchmarks/base-v1/tooling-typescript-rebuild/implementation-status.v1.json";

export type RepositoryRequirement = {
  id: string;
  path: string;
  present: boolean;
};

export async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

export async function assessTypeScriptRebuildQualification(root = ".") {
  const record = JSON.parse(
    await Deno.readTextFile(`${root}/${statusPath}`),
  ) as {
    workloadId: string;
    status: string;
    qualification: {
      repositoryRequirements: RepositoryRequirement[];
      qualifiedTarget: null;
    };
    coverage: { countsAsImplementedCatalogEntry: boolean };
  };

  const requirements = await Promise.all(
    record.qualification.repositoryRequirements.map(async (requirement) => ({
      id: requirement.id,
      path: requirement.path,
      expectedPresent: requirement.present,
      observedPresent: await pathExists(`${root}/${requirement.path}`),
    })),
  );
  const recordMatchesRepository = requirements.every((requirement) =>
    requirement.expectedPresent === requirement.observedPresent
  );

  return {
    schemaVersion: 1,
    workloadId: record.workloadId,
    status: record.status,
    qualified: record.qualification.qualifiedTarget !== null,
    countsAsImplementedCatalogEntry: record.coverage.countsAsImplementedCatalogEntry,
    recordMatchesRepository,
    requirements,
  };
}

if (import.meta.main) {
  const root = Deno.args[0] ?? ".";
  const assessment = await assessTypeScriptRebuildQualification(root);
  console.log(JSON.stringify(assessment, null, 2));
  if (!assessment.recordMatchesRepository) Deno.exit(1);
  if (assessment.qualified || assessment.countsAsImplementedCatalogEntry) Deno.exit(1);
}
