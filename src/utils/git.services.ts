import { ExecException, execSync } from "child_process";
import { ParsedGitDiff } from "../interfaces/git.services.interfaces";
import _ from "lodash";
import { writeGlobJson } from "./file.utils";

export class GitService {
	resolvePath: string = ".";
	appDir: string = "";
	jsonfile: string = "git-parsed-diff.json";

	constructor(appDir: string, resolvePath: string) {
		this.resolvePath = resolvePath;
		this.appDir = appDir;
	}

	/**
	 * Scan method
	 * เป็น function หลักในการ scan git log
	 */
	scan = () => {
		const currentCommitHash = this.executeCommand(
			`cd ${this.resolvePath} && git rev-parse HEAD`
		);
		if (currentCommitHash) {
			const currentDate = new Date();
			const endDate = new Date();
			endDate.setMonth(currentDate.getMonth() - 12 * 10);

			const rows: ParsedGitDiff[] = [];
			this.fetchCommits(rows, currentCommitHash as string, endDate);
			for (const commit of rows) {
				const parsedFiles = this.parseGitDiff(commit.diff);
				commit.files = parsedFiles;
				delete commit.diff;
			}
			writeGlobJson(this.appDir, JSON.stringify(rows, null, 2), this.jsonfile);
		}
	};

	/**
	 * Execute Command เป็น function ในการเรียกใช้ command script
	 *
	 * @param command - A string of command line.
	 * @returns A string or null
	 */
	executeCommand = (command: string): string | null => {
		const exec = `cd ${this.resolvePath} && ${command}`;
		try {
			return execSync(exec, {
				maxBuffer: 1024 ** 6,
			})
				.toString("utf8")
				.trim();
		} catch (e) {
			console.error(`Error executing command: ${exec}`);
			console.error((e as ExecException).message);
			return null;
		}
	};

	/**
	 * Not use
	 */
	private getRepositoryName = (): string | null => {
		return this.executeCommand(`git rev-parse --show-toplevel`);
	};

	/**
	 * Get commit details เพื่อดู author and date
	 *
	 * @param commitHash - A string git commit hash
	 * @returns An object from details split
	 */
	getCommitDetails = (commitHash: string) => {
		const details = this.executeCommand(`git show --quiet ${commitHash}`);
		if (!details) return null;
		const authorMatch = details.match(/Author:\s+(.*)\s+</);
		const authorName = authorMatch ? authorMatch[1] : "Unknown";
		const dateMatch = details.match(/Date:\s+(.*)/);
		const [hash, , authorEmail, date, ...message] = details.split("\n");
		return {
			authorName,
			authorEmail: "",
			commitDate: dateMatch ? new Date(dateMatch[1].trim()) : new Date(),
			commitHash: hash.split(" ")[1],
			commitMessage: message.join("\n").trim(),
		};
	};

	/**
	 * Get git diff details
	 *
	 * @param commitHash -  A string git commit hash
	 * @returns A string git diff
	 */
	getDiffDetails(commitHash: string) {
		return this.executeCommand(`git diff ${commitHash}~ ${commitHash}`);
	}

	/**
	 * Get previous commit hash จะเป็นการค้นหา commit ถัดจากปัจจุบัน
	 *
	 * @param currentHash - A string current git commit hash
	 * @returns A string or null
	 */
	getPreviousCommitHash = (currentHash: string): string | null => {
		return (
			this.executeCommand(`git rev-list --parents -n 1 ${currentHash}`)?.split(
				" "
			)[1] || null
		);
	};

	/**
	 * Fetch commits เพื่อค้นหา current git commit
	 *
	 * @param rows - An array.
	 * @param currentHash - A string current git commit hash
	 * @param endDate - A end datetime for filter commit datetime
	 * @Callback A rows
	 */
	fetchCommits = (rows: any[], currentHash: string, endDate: Date) => {
		const details = this.getCommitDetails(currentHash);
		if (!details) return;
		// console.log('details', details)
		const diff = this.getDiffDetails(currentHash);

		if (details.commitDate.getTime() < endDate.getTime()) {
			return;
		}
		// console.log('details.commitDate.getTime()', details.commitDate.getTime())
		const previousHash = this.getPreviousCommitHash(currentHash);
		// console.log('previousHash', previousHash)
		rows.push({ ...details, diff, previousHash });
		if (previousHash) {
			this.fetchCommits(rows, previousHash, endDate);
		}
	};

	/**
	 * Parse git diff
	 *
	 * @param diff - A string git diff
	 * @returns An array an object
	 */
	parseGitDiff = (diff?: string) => {
		try {
			if (!diff) return [];
			const lines = diff.split("\n");
			const files: any[] = [];
			let currentFile: any = null;
			let currentHunk: any = null;
			let hunkLineCounter = 0;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				if (line.startsWith("diff")) {
					if (currentFile) {
						files.push(currentFile);
						currentFile = null;
					}
					continue;
				}

				if (line.startsWith("Binary files")) {
					if (currentFile) {
						currentFile.binaryChange = true;
					}
					continue;
				}

				if (line.startsWith("rename from")) {
					if (!currentFile) {
						currentFile = {};
					}
					currentFile.renamedFile = {
						from: line.replace("rename from ", ""),
						to: lines[++i].replace("rename to ", ""),
					};
					continue;
				}

				if (line.startsWith("copy from")) {
					if (!currentFile) {
						currentFile = {};
					}
					currentFile.copiedFile = {
						from: line.replace("copy from ", ""),
						to: lines[++i].replace("copy to ", ""),
					};
					continue;
				}

				if (line.startsWith("old mode")) {
					if (!currentFile) {
						currentFile = {};
					}
					currentFile.fileModeChange = {
						oldMode: line.replace("old mode ", ""),
						newMode: lines[++i].replace("new mode ", ""),
					};
					continue;
				}

				if (line.startsWith("---")) {
					currentFile = {
						filePath: lines[i + 1].substring(4),
						changes: [],
						binaryChange: false,
						fileModeChange: null,
						renamedFile: null,
						copiedFile: null,
					};
					const parts = currentFile.filePath.split("/");
					currentFile.fileName = parts.pop()!;
					currentFile.directory = parts.join("/") + "/";
					currentFile.fileExtension = currentFile.fileName.split(".").pop()!;
					i++;
					continue;
				}

				if (line.startsWith("diff")) {
					if (currentFile) {
						files.push(currentFile);
						currentFile = null;
					}
					continue;
				}

				if (line.startsWith("---")) {
					currentFile = {
						filePath: lines[i + 1].substring(4), // Get the path after '+++ b/'
						changes: [],
					};
					const parts = currentFile.filePath.split("/");
					currentFile.fileName = parts.pop()!;
					currentFile.directory = parts.join("/") + "/";
					currentFile.fileExtension = currentFile.fileName.split(".").pop()!;
					i++; // Skip the next line (+++ b/file)
					continue;
				}

				if (line.startsWith("@@")) {
					if (currentHunk) {
						currentFile?.changes.push(currentHunk);
					}
					const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
					if (hunkMatch) {
						currentHunk = {
							hunkStart: parseInt(hunkMatch[1]),
							hunkLength: parseInt(hunkMatch[2]),
							hunkNewStart: parseInt(hunkMatch[3]),
							hunkNewLength: parseInt(hunkMatch[4]),
							lines: [],
						};
						hunkLineCounter = currentHunk.hunkNewStart;
					}
					continue;
				}

				if (currentHunk) {
					if (line.startsWith("+")) {
						currentHunk.lines.push({
							lineNumber: hunkLineCounter,
							action: "ADD",
						});
						hunkLineCounter++;
					} else if (line.startsWith("-")) {
						currentHunk.lines.push({
							lineNumber: hunkLineCounter,
							action: "REMOVE",
						});
					} else {
						hunkLineCounter++; // Non-added/removed lines increment the counter
					}
				}
			}

			if (currentHunk) {
				currentFile?.changes?.push(currentHunk);
			}
			if (currentFile) {
				files.push(currentFile);
			}

			return files;
		} catch (error) {
			console.error("Error while parsing the git diff:", error);
			return [];
		}
	};
}
