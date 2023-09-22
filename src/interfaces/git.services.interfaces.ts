export interface ParsedGitDiff {
	authorName: string;
	authorEmail: string;
	commitDate: string;
	commitHash: string;
	commitMessage: string;
	previousHash?: string;
	diff?: string;
	files: File[];
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
