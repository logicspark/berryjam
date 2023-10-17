import { resolve, join, extname, dirname, basename } from "path";
import BabelParser from "@babel/parser";
import { existsSync } from "fs";
import { loadConfig } from "tsconfig-paths";
import { glob } from "glob";
import { getFileInfo } from "./file.utils";
import type { ImportStatement, ImportStatementUsage } from "../types";
import logger from "./logger";
const traverse = require("@babel/traverse").default;

export const traverseImports = (
	filePath: string,
	content: string,
	babelParse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>,
	extension?: string
): ImportStatement[] | null => {
	try {
		const plugins: any = !extension
			? ["jsx"]
			: extension === ".tsx"
			? ["typescript", "jsx"]
			: ["typescript"];
		const ast = babelParse(content, {
			sourceType: "module",
			plugins,
		});
		let mappedImportList: ImportStatement[] = [];
		const importStatementUsages: ImportStatementUsage[] = [];
		const { currentDir } = getFileInfo(filePath);
		traverse(ast, {
			ImportDeclaration(astPath: any) {
				prepareMappedImportDeclaration(mappedImportList, filePath, astPath);
			},
			// Vue dynamic import with defineAsyncComponent
			VariableDeclarator(astPath: any) {
				prepareMappedVariableDeclarator(mappedImportList, filePath, astPath);
			},
			ExportDefaultDeclaration(astPath: any) {
				let properties = astPath.node.declaration.properties;
				if (properties?.length) {
					// export default {}
				} else {
					// export default defineComponent({ ... })
					properties = astPath.node.declaration.arguments?.at(0)?.properties;
					// logger.debug({ properties }, "ExportDefaultDeclaration");
				}
				properties?.forEach((prop: any) => {
					if (
						"components" === prop.key.name &&
						"ObjectExpression" === prop.value.type
					) {
						const { properties } = prop.value;
						properties.forEach((component: any) => {
							if (component.value.type === "Identifier") {
								const componentName =
									component.key.name ||
									component.key.value ||
									component.key.object.name;
								const componentSource = component.value.name;
								// Find the corresponding import statement
								const importDeclaration = ast.program.body.find(
									(node: any) =>
										node.type === "ImportDeclaration" &&
										node.specifiers.some(
											(specifier: any) =>
												specifier.local.name === componentSource
										)
								);
								if (!componentName) {
									logger.log({ component }, "Null ExportDefaultDeclaration");
								}
								if (importDeclaration) {
									const source = importDeclaration.source.value;
									const isRelative = /^\./.test(source);
									const currentImportLine = {
										importedNames: [componentName],
										source: isRelative ? resolve(currentDir, source) : source,
										importSourceType: isRelative ? "internal" : "external",
										destination: filePath,
									} as ImportStatement;
									mappedImportList.push(currentImportLine);
								}
							}
						});
					}
				});
			},
			ObjectProperty(path: any) {
				if (
					path.node.key.type === "Identifier" &&
					path.node.key.name === "component"
				) {
					if (
						path.node.value.type === "ArrowFunctionExpression" &&
						path.node.value.body.type === "CallExpression" &&
						path.node.value.body.callee.type === "Import"
					) {
						const nodeValue = path.node.value.body.arguments[0];
						const importPath = String(nodeValue.value);
						const line = Number(nodeValue.loc.start.line);
						importStatementUsages.push({
							lines: { [filePath]: [line] },
							dynamic: true,
							importPath,
						} as ImportStatementUsage);
					} else {
						//mean using the import statement
						//if (filePath?.includes("router.ts")) {
						const { name } = path.node.value;
						const found = mappedImportList.find((ele) =>
							ele.importedNames.includes(name)
						);
						if (found) {
							found.usage = {
								lines: {
									[filePath]: [Number(path.node.value.loc.start.line ?? 0)],
								},
								dynamic: false,
								importPath: found.source,
							};
						}
						// }
					}
				}
			},
		});
		if (importStatementUsages.length) {
			// process dynamic import
			const dynamicMappedImports = importStatementUsages.reduce(
				(acc, usage) => {
					const { importPath } = usage;
					const normalizedName = basename(importPath).replace(
						extname(importPath),
						""
					);
					const importedNames = [normalizedName];
					const isRelative = /^\./.test(importPath);
					const currentImportLine: ImportStatement = {
						importedNames,
						source: isRelative ? resolve(currentDir, importPath) : importPath,
						importSourceType: isRelative ? "internal" : "external",
						destination: filePath,
						usage,
					};
					acc.push(currentImportLine);
					return acc;
				},
				[] as ImportStatement[]
			);

			mappedImportList.push(...dynamicMappedImports);
		}
		return mappedImportList.length ? mappedImportList : null;
	} catch (e) {
		throw e;
	}
};

export function prepareMappedImportDeclaration(
	mappedImportList: ImportStatement[],
	filePath: string,
	astPath: any
) {
	const importStatement = astPath.node;
	// Extract the imported names and source
	const importedNames: string[] = importStatement.specifiers.map(
		(specifier: any) => {
			return specifier.local.name as string;
		}
	);
	const { currentDir } = getFileInfo(filePath);
	const source = importStatement.source.value;
	const isRelative = /^\./.test(source);
	const currentImportLine = {
		importedNames,
		source: isRelative ? resolve(currentDir, source) : source,
		importSourceType: isRelative ? "internal" : "external",
		destination: filePath,
	} as ImportStatement;
	mappedImportList.push(currentImportLine);
}

function prepareMappedVariableDeclarator(
	mappedImportList: ImportStatement[],
	filePath: string,
	astPath: any
) {
	const { id, init } = astPath.node;
	if (
		init &&
		init.type === "CallExpression" &&
		init.callee.name === "defineAsyncComponent"
	) {
		const variableName = id.name;
		if (!variableName) {
			return;
		}
		const { currentDir } = getFileInfo(filePath);
		const source = findDefineAsyncComponentStringLiteral(init.arguments);
		const isRelative = /^\./.test(source);
		const currentImportLine = {
			importedNames: [variableName],
			source: isRelative ? resolve(currentDir, source) : source,
			importSourceType: isRelative ? "internal" : "external",
			destination: filePath,
		} as ImportStatement;
		mappedImportList.push(currentImportLine);
	}
}

export async function getCodeConfigCompilerOptionPaths(
	packageJsonPath: string
) {
	const dir = resolve(dirname(packageJsonPath)).replace(/\\/g, "/");
	const searchPattern = `${dir}/**/{tsconfig,jsconfig}.json`;
	const foundConfigFiles = await glob(searchPattern);
	if (!foundConfigFiles?.length) return null;
	let pathsResult: Record<string, string[]> = {};
	for (const fPath of foundConfigFiles.filter(
		(ele) => !ele.includes("/node_modules/")
	)) {
		// logger.debug({ fPath });
		try {
			const result = loadConfig(fPath);
			const { resultType } = result;
			if ("success" === resultType) {
				// logger.debug({ result }, "[Func] getCodeConfigCompilerOptionPaths");
				const { absoluteBaseUrl, paths, baseUrl } = result;
				pathsResult = {
					...pathsResult,
					...Object.entries(paths).reduce(
						(obj, p) => {
							const key = p[0],
								value = p[1];
							if (typeof value == "object") {
								const newValue = value.map((ele: string) =>
									join(`${absoluteBaseUrl}`, ele)
								);
								obj[key] = newValue;
							} else {
								obj[key] = value;
							}
							return obj;
						},
						{} as Record<string, string[]>
					),
				};
			}
		} catch (error) {
			console.error(error, "[Func] getCodeConfigCompilerOptionPaths");
		}
	}
	return Object.keys(pathsResult)?.length ? pathsResult : null;
}

export function getTsConfigCompilerOption(packageJsonPath: string) {
	const result = loadConfig(resolve(dirname(packageJsonPath)));
	const { resultType } = result;
	if ("success" === resultType) {
		const { absoluteBaseUrl, paths, baseUrl } = result;
		return { paths, baseUrl, absoluteBaseUrl };
	} else {
		return null;
	}
}

export function replaceAliasPath(
	importPath: string,
	paths: Record<string, string[]>
) {
	// Iterate over the paths configuration
	for (const aliasPath of Object.keys(paths)) {
		for (const absPath of paths[aliasPath]) {
			let replacedPath = "";
			if (
				aliasPath.endsWith("/*") &&
				importPath.startsWith(aliasPath.slice(0, -1))
			) {
				replacedPath = importPath.replace(
					aliasPath.slice(0, -1),
					absPath.slice(0, -1)
				);
			}
			if (importPath !== aliasPath && importPath.startsWith(aliasPath)) {
				replacedPath = importPath.replace(aliasPath, absPath);
			}
			const ext = extname(replacedPath);
			const extensions = [".js", ".jsx", ".ts", ".tsx", ".vue"];
			if (!ext || !extensions.includes(ext)) {
				for (const ext of extensions) {
					const fullPath = replacedPath + ext;
					if (existsSync(fullPath)) {
						return fullPath;
					}
				}
			} else {
				if (existsSync(replacedPath)) {
					return replacedPath;
				}
			}
		}
	}
	return importPath;
}

export async function getViteAliasPaths(
	packageJsonPath: string,
	babelParse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>
) {
	const currentDir = resolve(dirname(packageJsonPath)).replace(/\\/g, "/");
	const foundConfigFiles = await glob(`${currentDir}/vite.config.{js,ts}`);
	if (!foundConfigFiles?.length) {
		return null;
	}
	const viteConfigFilePath = foundConfigFiles.at(0);
	const extension = extname(viteConfigFilePath!);

	const plugins: any[] = extension === ".ts" ? ["typescript"] : [];
	const { fileContent } = getFileInfo(viteConfigFilePath!);
	const ast = babelParse(fileContent, {
		sourceType: "module",
		plugins,
	});
	let pathAlias = {};
	traverse(ast, {
		ExportDefaultDeclaration(path: any) {
			// Process the export default declaration
			const { node } = path;
			if (node.declaration.callee?.name === "defineConfig") {
				const resolveProperty = node.declaration.arguments[0]?.properties?.find(
					(property: any) => property.key.name === "resolve"
				);
				if (resolveProperty) {
					const aliasProperty = resolveProperty.value.properties.find(
						(property: any) => property.key.name === "alias"
					);

					if (aliasProperty) {
						const aliasValue = aliasProperty.value;
						if (aliasValue.type === "ObjectExpression") {
							pathAlias = aliasValue.properties.reduce(
								(acc: Record<string, string[]>, prop: any) => {
									if (prop.value.value) {
										acc[prop.key.value] = [
											resolve(currentDir, prop.value.value),
										];
									} else {
										if (prop.value.arguments) {
											//prop.value.arguments[0].arguments
											acc[prop.key.value] = [
												resolve(
													currentDir,
													findAliasStringLiteral(prop.value.arguments)
												),
											];
										}
									}
									return acc;
								},
								{} as Record<string, string[]>
							);
						}
					}
				}
			}
		},
	});
	return Object.keys(pathAlias).length ? pathAlias : null;
}

function findAliasStringLiteral(args: any[]): string {
	let result: string = "";
	for (const arg of args) {
		const { type, value } = arg;
		if ("StringLiteral" === type) {
			result = value;
			break;
		}
		if (arg.arguments?.length) {
			return findAliasStringLiteral(arg.arguments);
		}
	}
	return result;
}

function findDefineAsyncComponentStringLiteral(args: any[]): string {
	let result = "";
	for (const arg of args) {
		const { type, value } = arg;
		if ("StringLiteral" === type) {
			result = value;
			break;
		}
		if (arg.body.arguments?.length) {
			return findDefineAsyncComponentStringLiteral(arg.body.arguments);
		}
	}
	return result;
}
