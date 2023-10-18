export interface ParsedGitDiff {
	commit: GitDiffResult;
	authorName: string;
	authorEmail: string;
	commitDate: string;
	commitHash: string;
	commitMessage: string;
	previousHash?: string;
	diff?: string;
	files?: GitDiffResult;
}

export interface File {
	filePath?: string;
	binaryChange?: boolean;
	fileModeChange: any;
	renamedFile?: RenamedFile;
	copiedFile: any;
	fileName?: string;
	directory?: string;
	fileExtension?: string;
}

export interface RenamedFile {
	from: string;
	to: string;
}

export interface GitParserFile {
	deletedFile: boolean;
	addedFile: boolean;
	renamedFile: boolean;
	binaryChange: boolean;
	editedFile: boolean;
	from: string;
	to: string;
	oldfileName: string;
	fileName: string;
	fileExtension: string;
}

export interface GitDiffResult {
	detailed: boolean;
	commits: any[];
}
