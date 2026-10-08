import * as fs from "node:fs";
import { set_fs } from "xlsx";

// SheetJS's ESM build requires an explicit filesystem adapter for readFile/writeFile.
set_fs(fs);

export * from "xlsx";
