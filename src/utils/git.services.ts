import { ExecException, execSync } from "child_process";
import { ParsedGitDiff } from "../interfaces/git.services.interfaces";
import _ from "lodash";
import { writeGlobJson } from "./file.utils";
import { GitParser } from "./git.parser";

export class GitService {
	resolvePath: string = ".";
	appDir: string = "";
	jsonfile: string = "git-parsed-diff.json";

	constructor(appDir: string, resolvePath: string) {
		this.resolvePath = resolvePath;
		this.appDir = appDir;
	}

	/**
	 * Scan git log of the project to retrieve relevant git history such as.
	 * author, datetime and file changes to output as a JSON file.
	 */
	scan = () => {
		const currentCommitHash = this.executeCommand(
			`cd ${this.resolvePath} && git rev-parse HEAD`
		);
		if (currentCommitHash) {
			const currentDate = new Date();
			const endDate = new Date();
			endDate.setMonth(currentDate.getMonth() - 12 * 5);

			const rows: ParsedGitDiff[] = [];
			this.fetchCommits(rows, currentCommitHash as string, endDate);

			writeGlobJson(
				this.appDir,
				JSON.stringify(rows, null, 2),
				"git-diff.json"
			);

			// Better viewing of linenumbers
			let results: ParsedGitDiff[] = [];
			for (const commit of rows) {
				if (commit.diff != null) {
					const diff = new GitParser(commit.diff);
					commit.files = diff.result;
				}
				delete commit.diff;
				if (commit.files) {
					if (commit.files.detailed) {
						results.push(commit);
					}
				}
			}
			writeGlobJson(
				this.appDir,
				JSON.stringify(results, null, 2),
				this.jsonfile
			);
		}
	};

	/**
	 * This function sends a string as a command to run in Shell.
	 *
	 * @param command - A string of command line.
	 * @returns A string or null.
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
	 * Get commit details for author name and datetime.
	 *
	 * @param commitHash - A string of git commit hash.
	 * @returns An object of author name and datetime that are split from commit details.
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
	 * Get git diff details such as filename change, line location and file path.
	 *
	 * @param commitHash -  A string of git commit hash.
	 * @returns A string of information taken from git diff details.
	 */
	getDiffDetails(commitHash: string) {
		return this.executeCommand(`git diff ${commitHash}~ ${commitHash}`);
	}

	/**
	 * Get the previous commit hash from the current commit hash.
	 *
	 * @param currentHash - A string of git commit hash (current).
	 * @returns A string or null.
	 */
	getPreviousCommitHash = (currentHash: string): string | null => {
		return (
			this.executeCommand(`git rev-list --parents -n 1 ${currentHash}`)?.split(
				" "
			)[1] || null
		);
	};

	/**
	 * Fetch commits by looping each current git commit to get the previous git commit within a certain period.
	 *
	 * @param rows - An array.
	 * @param currentHash - A string of current git commit hash.
	 * @param endDate - An end datetime to filter commits from the end datetime to the current date.
	 * @callback rows
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
	 * Parse git diff details to transform into an object for readability.
	 *
	 * @param diff - A string of git diff details.
	 * @returns An array of object.
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

				console.log("line===>", line);

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
