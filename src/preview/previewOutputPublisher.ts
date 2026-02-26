import { stat } from "node:fs/promises";
import { dirname, extname, basename, join } from "node:path";

import { PreviewTarget } from "./contracts";

export interface PreviewOutputPublishContract {
  computeOutputPath(target: PreviewTarget): string;
  ensureArtifactExists(path: string): Promise<boolean>;
}

export class PreviewOutputPublisher implements PreviewOutputPublishContract {
  public computeOutputPath(target: PreviewTarget): string {
    const root = dirname(target.filePath);
    const name = basename(target.filePath);
    const stem = name.slice(0, name.length - extname(name).length);

    return join(root, `${stem}.pdf`);
  }

  public async ensureArtifactExists(path: string): Promise<boolean> {
    try {
      const entry = await stat(path);
      return entry.isFile();
    } catch {
      return false;
    }
  }
}
