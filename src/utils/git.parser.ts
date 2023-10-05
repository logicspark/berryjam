import { exit } from "process";
import {
	GitParserFile,
	GitDiffResult,
} from "../interfaces/git.services.interfaces";
import { supportFileType } from "./file.utils";

export class GitParser {
	lines: string[];
	result: GitDiffResult = { detailed: false, commits: [] };
	line: number = 0;
	currentCommit: any;

	constructor(gitDiff: string) {
		this.lines = gitDiff.split("\n");
		while (this.line < this.lines.length) {
			const line = this.lines[this.line];
			// Metadata?
			if (line.indexOf("From ") === 0) {
				this.parseMetadata();
			} else if (line.indexOf("diff ") === 0) {
				this.parseDiff();
			} else {
				this.line++;
			}
		}
		if (this.currentCommit) {
			this.result.commits.push(this.currentCommit);
		}
	}

	parseFile = function (s) {
		s = s.trim();
		if (s[0] === '"') {
			s = s.slice(1, -1);
		}
		// ignore possible time stamp
		const t = /\d{4}-\d\d-\d\d\s\d\d:\d\d:\d\d(.\d+)?\s(\+|-)\d\d\d\d/.exec(s);
		if (t) {
			s = s.substring(0, t.index).trim();
		}
		// ignore git prefixes a/ or b/
		if (s.match(/^(a|b)\//)) {
			return s.substr(2);
		} else {
			return s;
		}
	};

	parseDiff() {
		if (!this.currentCommit) {
			this.currentCommit = { files: [] };
		}
		const file: GitParserFile = {
			deletedFile: false,
			addedFile: false,
			renamedFile: false,
			binaryChange: false,
			editedFile: false,
			from: "",
			to: "",
			oldfileName: "",
			fileName: "",
			fileExtension: "",
		};

		let firstRun = true;
		let lineBreak = false;

		let lnDel = 0;
		let lnAdd = 0;
		const noeol = "\\ No newline at end of file";

		while (this.line < this.lines.length) {
			let matches: any;
			const line = this.lines[this.line];

			if (
				(line.indexOf("diff ") === 0 && !firstRun) ||
				(this.result.detailed && line === "-- ")
			) {
				break;
			}

			if (line.indexOf("diff ") === 0) {
				// Git diff?
				matches = line.match(
					/^diff\s\-\-git\s("a\/.*"|a\/.*)\s("b\/.*"|b\/.*)$/
				);

				if (matches.length === 3) {
					file.from = this.parseFile(matches[1]);
					file.to = this.parseFile(matches[2]);
				}
			} else if (line.indexOf("+++ ") === 0) {
				if (!file.to) {
					file.to = this.parseFile(line.substr(4));
				}
			} else if (line.indexOf("--- ") === 0) {
				if (!file.from) {
					file.from = this.parseFile(line.substr(4));
				}
			} else if (line === "GIT binary patch") {
				file.binaryChange = true;
				break;
			} else if (/^deleted file mode \d+$/.test(line)) {
				file.deletedFile = true;
			} else if (/^new file mode \d+$/.test(line)) {
				file.addedFile = true;
			} else if (/^new file mode \d+$/.test(line)) {
				file.addedFile = true;
			} else if (/^Binary\sfiles\s(.*)differ$/.test(line)) {
				file.binaryChange = true;
				break;
			} else if (/^@@\s+\-(\d+),(\d+)\s+\+(\d+),(\d+)\s@@/.test(line)) {
				matches = line.match(/^@@\s+\-(\d+),(\d+)\s+\+(\d+),(\d+)\s@@/);
				lineBreak = false;
				lnDel = +matches[1];
				lnAdd = +matches[3];
			} else {
				lineBreak = false;
			}
			firstRun = false;
			this.line++;
		}

		if (file.from === "/dev/null") {
			file.addedFile = true;
		} else {
			file.renamedFile =
				!file.addedFile && !file.deletedFile && file.to !== file.from;
			if (file.renamedFile) {
				file.oldfileName = file.from;
			}
		}

		file.fileName = file.to;
		file.fileExtension = file.to.split(".").pop()!;
		const { from, to, ...rest } = Object.assign({}, file);

		if (supportFileType().includes(file.fileExtension)) {
			this.result.detailed = true;

			if (!file.addedFile && !file.deletedFile && !file.renamedFile) {
				rest.editedFile = true;
			}

			return this.currentCommit.files.push(rest);
		} else {
			return this.currentCommit;
		}
	}

	parseMetadata() {
		this.result.detailed = true;
		if (this.currentCommit) {
			this.result.commits.push(this.currentCommit);
		}
		this.currentCommit = { files: [] };
		let isGettingMessage = false;
		return (() => {
			const result: number[] = [];
			while (this.line < this.lines.length) {
				var matches;
				const line = this.lines[this.line];

				if (line.indexOf("diff ") === 0) {
					break;
				}

				if (isGettingMessage) {
					if (line.indexOf("---") === 0) {
						isGettingMessage = false;
					} else {
						this.currentCommit.message +=
							line.indexOf(" ") === 0 ? line : `\n${line}`;
					}
				} else if (line.indexOf("From ") === 0) {
					matches = line.match(/^From\s([a-z|0-9]*)\s(\w.*)$/);
					if (matches.length === 3) {
						this.currentCommit.sha = matches[1];
						this.currentCommit.date = new Date(matches[2]);
					}
				} else if (line.indexOf("From: ") === 0) {
					matches = line.match(/^From:\s(.*)\s\<(\w.*)\>$/);
					if (matches.length === 3) {
						this.currentCommit.author = matches[1];
						this.currentCommit.email = matches[2];
					} else {
						console.log(line);
						exit();
					}
				} else if (line.indexOf("Date: ") === 0) {
					matches = line.match(/^Date:\s(\w.*)$/);

					if (matches.length === 2) {
						this.currentCommit.date = new Date(matches[1]);
					}
				} else if (line.indexOf("Subject: ") === 0) {
					this.currentCommit.message = line.substr(9);
					isGettingMessage = true;
				}
				result.push(this.line++);
			}
			return result;
		})();
	}
}
