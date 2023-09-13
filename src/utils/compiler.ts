import { transformSync } from "@babel/core";
import BabelParser, { parse as babelParse } from "@babel/parser";
import { parse as domParse, NodeTypes } from "@vue/compiler-dom";
import CompilerSFC, { compileScript, SFCDescriptor } from "@vue/compiler-sfc";
import { existsSync } from "fs";
import * as ts from "typescript";

import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { BAN_TAGS } from "./constants";
import { checkFileTypeExists, getFileInfo } from "./file.utils";
import { HTML_TAGS } from "./html-tags";
import { VueASTNode } from "../types";

import type {
	ImportStatement,
	ParsedCodeResult,
	TraversedTag,
	VueProperty,
} from "../types";

import {
	ArrayExpression,
	CallExpression,
	ExportDefaultDeclaration,
	ExportNamedDeclaration,
	Identifier,
	isArrayExpression,
	isCallExpression,
	isExportDefaultDeclaration,
	isExportNamedDeclaration,
	isIdentifier,
	isObjectExpression,
	isObjectProperty,
	isSpreadElement,
	ObjectExpression,
	ObjectProperty,
	SpreadElement,
	StringLiteral,
	VariableDeclaration,
	VariableDeclarator,
} from "@babel/types";
import { SUPPORT_EXT } from "./constants";
// import logger, { logErrorMessage } from "./logger";
import {
	prepareMappedImportDeclaration,
	traverseImports,
} from "./module.utils";

const generate = require("@babel/generator").default;
const traverse = require("@babel/traverse").default;

const htmlTags: string[] = HTML_TAGS;
const banTags: string[] = BAN_TAGS;

export function parseVue(
	filePath: string,
	parse: (
		s: string,
		opt?: CompilerSFC.SFCParseOptions
	) => CompilerSFC.SFCParseResult,
	babelParse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>
): ParsedCodeResult {
	const componentTags: TraversedTag[] = [];
	let importStatements: ImportStatement[] | null = null;
	let properties: VueProperty[] = [];
	try {
		const { fileContent, fileName, currentDir } = getFileInfo(filePath);
		const parsed = parse(fileContent, { filename: fileName, sourceMap: false });
		const { descriptor, errors } = parsed;

		if (errors?.length) {
			throw errors;
		}
		const { template, script, scriptSetup } = descriptor;

		properties = compileVue(descriptor, filePath);

		const scriptContent = `${script?.content || scriptSetup?.content || ""}`;
		importStatements = traverseImports(
			currentDir,
			scriptContent,
			babelParse,
			script?.lang || scriptSetup?.lang
		);

		if (template) {
			const ast = template.ast as unknown as VueASTNode;
			const result = traverseVueTags(ast, [], []);
			result?.customTags && componentTags.push(...result.customTags);
		}
	} catch (error) {
		console.error(error, `[Func] parseVue ${filePath}`);
	}
	return {
		componentTags,
		importStatements,
		properties,
	};
}

export function parseJs(
	filePath: string,
	parse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>
): ParsedCodeResult {
	const customTags: TraversedTag[] = [];
	const nativeTags: TraversedTag[] = [];
	const mappedImportList: ImportStatement[] = [];
	const fileContent = readFileSync(filePath, "utf8");
	const currentDir = dirname(filePath);
	try {
		const ast = parse(fileContent, {
			sourceType: "module",
			plugins: ["jsx"],
		});
		const { errors } = ast;
		if (errors?.length) {
			throw errors;
		}

		traverse(ast, {
			ImportDeclaration(path: any) {
				prepareMappedImportDeclaration(mappedImportList, currentDir, path);
			},
			ObjectProperty(path: any) {
				if (
					path.node.key.name === "template" &&
					path.node.value.type === "TemplateLiteral"
				) {
					const template = path.node.value;
					for (const quasi of template.quasis) {
						const text = quasi.value.raw;
						const parsed = parse(text, {
							sourceType: "module",
							plugins: ["jsx"],
						});
						traverse(parsed, {
							JSXElement(path: any) {
								const tag = path.node.openingElement.name.name;
								const row = path.node.openingElement.loc.start.line;
								if (tag) {
									const traverseTag = {
										tag,
										row,
									};
									transformTraversedTags(traverseTag, customTags);
								}
							},
						});
					}
				}
			},
		});
	} catch (error) {
		console.error(error, `[Func] parseJs => ${filePath}`);
	}
	return {
		componentTags: customTags,
		importStatements: mappedImportList?.length ? mappedImportList : null,
	};
}

export function parseJsx(
	filePath: string,
	parse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any> | null
): ParsedCodeResult {
	const customTags: TraversedTag[] = [];
	const mappedImportList: ImportStatement[] = [];
	let properties: VueProperty[] = [];
	const { fileContent, currentDir } = getFileInfo(filePath);
	try {
		const parsed = parse(fileContent, {
			sourceType: "module",
			plugins: ["jsx"],
		});
		const { errors } = parsed;
		if (errors?.length) {
			throw errors;
		}
		traverse(parsed, {
			ImportDeclaration(path: any) {
				prepareMappedImportDeclaration(mappedImportList, currentDir, path);
			},
			JSXElement(path: any) {
				const tag = path.node.openingElement.name.name;
				const row = path.node.openingElement.loc.start.line;
				if (tag) {
					const traverseTag = {
						tag,
						row,
					};
					transformTraversedTags(traverseTag, customTags);
				}
			},
			ExportDeclaration(path: any) {
				properties = getJsxProps(path.node);
			},
		});
	} catch (error) {
		console.error(error, "[Func] parseJsx");
	}
	return {
		componentTags: customTags,
		importStatements: mappedImportList.length ? mappedImportList : null,
		properties,
	};
}

export function parseTypescript(
	filePath: string,
	extension: ".ts" | ".tsx",
	babelParse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>
): ParsedCodeResult {
	let componentTags: TraversedTag[] = [];
	const { fileContent, currentDir } = getFileInfo(filePath);
	let importStatements: ImportStatement[] | null = null;
	let properties: VueProperty[] = [];
	try {
		importStatements = traverseImports(
			currentDir,
			fileContent,
			babelParse,
			extension
		);
		try {
			if (extension === ".tsx") {
				const result = parseTsx(fileContent, filePath);
				componentTags = result.componentTags;
			}
		} catch (err) {
			console.error(err, `[Func parseTypescript] ${filePath}`);
		}
		properties = getTsxProps(fileContent, filePath);
	} catch (error) {
		console.error(error, filePath);
	}

	return { componentTags, importStatements, properties };
}

export function parseComponentsDeclaration(
	filePath: string,
	babelParse: (
		s: string,
		opt?: BabelParser.ParserOptions
	) => BabelParser.ParseResult<any>
) {
	const componentDeclarations: ImportStatement[] | null = [];
	try {
		const { fileContent, currentDir } = getFileInfo(filePath);
		// logger.debug({ filePath }, "[Func] parseComponentsDeclaration");
		const ast = babelParse(fileContent, {
			sourceType: "module",
			plugins: ["typescript"],
		});

		traverse(ast, {
			TSModuleDeclaration(path: any) {
				const { node } = path;
				// logger.debug({ nodeId: node?.id?.value, nodeType: node?.body?.type });
				if (
					node?.id.value?.includes("vue") &&
					node?.body?.type === "TSModuleBlock"
				) {
					node.body.body.forEach((ele: any) => {
						if (ele.type === "ExportNamedDeclaration") {
							ele.declaration.body.body.forEach((declaration: any) => {
								const { typeAnnotation } = declaration.typeAnnotation;
								const keyName = declaration.key.name || declaration.key.value;
								if (!keyName) {
									//logger.debug({ declaration });
								}
								if (typeAnnotation) {
									const { objectType } = typeAnnotation;
									const importFrom = objectType.exprName.argument.value;
									// console.log("objectType", objectType.exprName.argument.value);
									// console.log("indexType", Object.entries(indexType.literal));
									// typeAnnotation.forEach((anotation: any) => {
									// 	console.log("anotation keys", Object.entries(anotation));
									// });
									const isRelative = /^\./.test(importFrom);
									const currentImportLine = {
										importedNames: [keyName],
										source: isRelative
											? resolve(currentDir, importFrom)
											: importFrom,
										importSourceType: isRelative ? "internal" : "external",
									} as ImportStatement;
									componentDeclarations.push(currentImportLine);
								}
							});
						}
						//if (ele.type === "TSInterfaceDeclaration") {
						/* ele.body.body.forEach((declaration: any) => {
						console.log("declaration", declaration);
						if (
							declaration.type === "TSPropertySignature" &&
							declaration.key.type === "Identifier"
						) {
							const componentName = declaration.key.name;
							const importPath =
								declaration.typeAnnotation.typeAnnotation.literal.value;

							componentDeclarations[componentName] = importPath;
						}
					}); */
						//}
					});
				}
			},
		});
		// logger.debug({ componentDeclarations: componentDeclarations.length });
	} catch (error) {
		console.error(error, "[Func] parseComponentsDeclaration");
	}

	return componentDeclarations.length ? componentDeclarations : null;
}

export function parseNuxtGlobalTypes(filePath: string) {
	const { currentDir } = getFileInfo(filePath);
	const fileContent = ts.sys.readFile(filePath);

	if (fileContent) {
		try {
			// Create a SourceFile from the file content
			const sourceFile = ts.createSourceFile(
				filePath,
				fileContent,
				ts.ScriptTarget.Latest
			);
			// const componentDeclarations: ImportStatement[] | null = [];
			// logger.debug({ filePath }, "[Func] parseNuxtGlobalTypes");
			const componentDeclarations = traverseAST(sourceFile, handleNode);
			// logger.debug({ componentDeclarations: componentDeclarations });
			// if (filePath.endsWith("components.d.ts")) {
			// 	logger.debug({ componentDeclarations: componentDeclarations });
			// }
			return componentDeclarations.map((ele) => {
				const isRelative = /^\./.test(ele.source);
				ele.source = isRelative ? resolve(currentDir, ele.source) : ele.source;
				return ele;
			});
		} catch (error) {
			console.error(error, "[Func] parseNuxtGlobalTypes");
			return null;
		}
	} else {
		console.error(
			{ error: "Failed to read file", filePath },
			"[Func] parseNuxtGlobalTypes"
		);
		return null;
	}
}

function traverseAST(
	node: ts.Node,
	callback: (node: ts.Node) => ImportStatement[]
) {
	const results: ImportStatement[] = [];
	const result = callback(node);
	results.push(...result);
	ts.forEachChild(node, (childNode) => {
		const childResults = traverseAST(childNode, callback);
		results.push(...childResults);
	});
	return results;
}

function handleNode(node: ts.Node): ImportStatement[] {
	// logger.debug({
	// 	"ts(node)": [
	// 		ts.isClassDeclaration(node),
	// 		ts.isModuleDeclaration(node),
	// 		ts.isFunctionDeclaration(node),
	// 		ts.isImportDeclaration(node),
	// 		ts.isVariableStatement(node),
	// 	],
	// });
	const componentDeclarations: ImportStatement[] | null = [];
	if (ts.isVariableStatement(node)) {
		const declaration = node.declarationList.declarations.at(0) as any;
		if (declaration) {
			const keyName = declaration.name?.escapedText;
			// console.log("DeclarationName", keyName);
			const objectType = declaration.type?.objectType;
			if (objectType) {
				const importFrom = objectType.argument.literal.text;
				const isRelative = /^\./.test(importFrom);
				const currentImportLine = {
					importedNames: [keyName],
					source: importFrom,
					importSourceType: isRelative ? "internal" : "external",
				} as ImportStatement;
				componentDeclarations.push(currentImportLine);
			}
		}
	} else if (ts.isModuleDeclaration(node)) {
		// Check if it's the declare module "vue" block
		if (ts.isStringLiteral(node.name) && node.name.text === "vue") {
			const moduleBlock = node.body as ts.ModuleBlock;
			for (const statement of moduleBlock.statements) {
				if (ts.isInterfaceDeclaration(statement)) {
					// Check if it's the ComponentCustomProperties interface
					if (statement.name.text === "ComponentCustomProperties") {
						// Traverse the members of the interface
						for (const member of statement.members) {
							if (ts.isPropertySignature(member)) {
								const componentName = member.name.getText();
								const importType = member.type
									? member.type.getText()
									: undefined;
								console.log("Component:", componentName);
								console.log("Import type:", importType);
							}
						}
					}
				}
			}
		}
	} else if (ts.isImportDeclaration(node)) {
		// Handle import declarations
		const { moduleSpecifier, importClause } = node as any;
		const importPath = (moduleSpecifier as any)?.text;
		let importName = importClause?.namedBindings?.elements?.at(0)?.name;
		// console.log(
		// 	"Import path:",
		// 	importPath,
		// 	importClause.namedBindings.elements.at(0).name
		// );
		if (importName && typeof importName !== "string") {
			importName = importName.escapedText;
		}
		if (importPath && importName) {
			const currentImportLine = {
				importedNames: [importName],
				source: importPath,
				importSourceType: null,
			} as ImportStatement;
			componentDeclarations.push(currentImportLine);
		}
	} else if (ts.isClassDeclaration(node)) {
		// Handle class declarations
		const className = node.name?.getText();
		console.log("Class name:", className);
	}
	// Add more conditions for different types of nodes you want to handle
	return componentDeclarations;
}

function getSetupScriptProps(
	compiledScript: CompilerSFC.SFCScriptBlock,
	filePath: string
) {
	const defineProps = compiledScript.scriptSetupAst!.find(
		(ele) =>
			ele.type === "VariableDeclaration" &&
			ele.declarations[0].init?.type === "CallExpression" &&
			ele.declarations[0].init.callee.type === "Identifier" &&
			ele.declarations[0].init.callee.name === "defineProps"
	) as VariableDeclaration;
	if (!defineProps) {
		return [];
	}
	const expression = defineProps.declarations[0].init as CallExpression;
	const reference = expression.typeParameters?.params[0] as any;
	if (!reference) {
		const objectExpression = expression.arguments[0];
		if (isObjectExpression(objectExpression)) {
			return handleObjectAttr(objectExpression, compiledScript, filePath);
		} else if (isArrayExpression(objectExpression)) {
			return handleArrayAttr(objectExpression);
		} else if (isIdentifier(objectExpression)) {
			return handleIdentifier(objectExpression, compiledScript, filePath);
		}
	}
	const propKeys = Object.keys(reference._resolvedElements.props);
	const props = propKeys.map((key) => {
		const prop =
			reference._resolvedElements.props[key].typeAnnotation.typeAnnotation;
		return {
			name: key,
			type: generate(prop).code,
		};
	});
	return props;
}

function handleObjectAttr(
	objectExpression: ObjectExpression,
	compiledScript?: CompilerSFC.SFCScriptBlock,
	filePath?: string
) {
	let props: VueProperty[] = [];
	const properties = objectExpression.properties as ObjectProperty[];
	properties.forEach((ele) => {
		if (isIdentifier(ele.value) && isIdentifier(ele.key)) {
			props.push({ name: ele.key.name, type: ele.value.name });
		} else if (isIdentifier(ele.key) && isObjectExpression(ele.value)) {
			const propValue = ele.value.properties as ObjectProperty[];
			const typeKey = propValue.find(
				(key) => isIdentifier(key.key) && key.key.name === "type"
			) as ObjectProperty;
			let type: string = "any";
			if (typeKey) {
				const typeValue = typeKey.value;
				type = isIdentifier(typeValue)
					? typeValue.name.toLowerCase()
					: generate(typeValue).code;
			}
			props.push({
				name: ele.key.name,
				type,
			});
		} else if (isSpreadElement(ele)) {
			const spreadElement = ele as SpreadElement;
			const identifier = spreadElement.argument;
			if (isIdentifier(identifier) && compiledScript && filePath) {
				const name = identifier.name;
				const imports = compiledScript.imports?.[name];
				const importPath = join(dirname(filePath), imports?.source || "");
				const { filePath: path } = checkFileTypeExists(
					importPath || "",
					SUPPORT_EXT
				);
				props.push({
					name,
					path,
				});
			}
		}
	});
	return props;
}

function handleArrayAttr(objectExpression: ArrayExpression): VueProperty[] {
	const propertiesKey = objectExpression.elements as StringLiteral[];
	return propertiesKey.map((ele) => ({ name: ele.value, type: "any" }));
}

function handleIdentifier(
	objectExpression: Identifier,
	compiledScript: CompilerSFC.SFCScriptBlock,
	filePath: string
) {
	const variableName = objectExpression.name;
	const variableSource = compiledScript.imports?.[variableName].source;
	const importPath = join(dirname(filePath), variableSource || "");
	const { filePath: path } = checkFileTypeExists(importPath || "", SUPPORT_EXT);
	return [
		{
			name: variableName,
			path,
		},
	];
}

function getScriptProps(
	compiledScript: CompilerSFC.SFCScriptBlock,
	filePath: string
) {
	const ast = compiledScript.scriptAst;
	const defaultDeclaration = ast!.find(
		(ele) => ele.type === "ExportDefaultDeclaration"
	) as ExportDefaultDeclaration;
	const vueObject = defaultDeclaration.declaration;
	let objKeys: ObjectProperty[] | undefined;
	if (isCallExpression(vueObject)) {
		const defineArgument = vueObject.arguments[0] as ObjectExpression;
		objKeys = defineArgument.properties as ObjectProperty[];
	} else if (isObjectExpression(vueObject)) {
		objKeys = vueObject.properties as ObjectProperty[];
	}
	const propsKey = objKeys?.find(
		(ele) => (ele.key as Identifier).name === "props"
	);
	if (!propsKey) {
		return [];
	}
	if (isArrayExpression(propsKey.value)) {
		return handleArrayAttr(propsKey.value);
	} else if (isObjectExpression(propsKey.value)) {
		return handleObjectAttr(propsKey.value, compiledScript, filePath);
	}
	return [];
}

export function compileVue(descriptor: SFCDescriptor, filePath: string) {
	// const { fileContent, fileName, currentDir } = getFileInfo(filePath);
	// if (fileName !== "CtrlPAPanel.vue") {
	// if (
	// 	filePath !==
	// 	"/Users/fang/repository/dtc-app/src/pages/controls/lifts/LiftEventsTable.vue"
	// ) {
	// 	return [];
	// }

	let props: any = [];
	try {
		if (!descriptor.script && !descriptor.scriptSetup) {
			return props;
		}
		const compiledScript = compileScript(descriptor, {
			id: new Date().getTime().toString(),
			globalTypeFiles: [],
			fs: {
				fileExists(file) {
					const path = join(dirname(filePath), file);
					return existsSync(path);
				},
				readFile(file) {
					const path = join(dirname(filePath), file);
					return readFileSync(path, "utf8");
				},
			},
		});
		if (descriptor.script) {
			props = getScriptProps(compiledScript, filePath);
		} else if (descriptor.scriptSetup) {
			props = getSetupScriptProps(compiledScript, filePath);
		}
		return props;
	} catch (err) {
		// console.log("catch", filePath, err);
		return [{ name: `error on ${filePath}`, type: "" }];
	}
}

function getJsxProps(node: ExportDefaultDeclaration | ExportNamedDeclaration) {
	if (isExportDefaultDeclaration(node)) {
		const exportObj = node.declaration as ObjectExpression | CallExpression;
		let propsKey: ObjectProperty | undefined = undefined;
		let properties: ObjectProperty[] = [];
		const exportObjType = exportObj.type;
		if (exportObjType === "CallExpression") {
			exportObj.arguments.forEach((p: any) => {
				// logger.debug({ properties: p.properties });
				p.properties && properties.push(...p.properties);
			});
		} else if (exportObjType === "ObjectExpression") {
			properties.push(...(exportObj.properties as ObjectProperty[]));
		} else {
		}
		propsKey = properties?.find(
			(ele) =>
				isObjectProperty(ele) &&
				isIdentifier(ele.key) &&
				ele.key.name === "props"
		) as ObjectProperty | undefined;

		if (!propsKey) {
			return [];
		}
		if (isArrayExpression(propsKey.value)) {
			return handleArrayAttr(propsKey.value);
		} else if (isObjectExpression(propsKey.value)) {
			return handleObjectAttr(propsKey.value);
		}
	} else if (isExportNamedDeclaration(node)) {
		const exportVariable = node.declaration as VariableDeclaration;
		const declarator = exportVariable?.declarations as VariableDeclarator[];
		const exportValue = declarator?.at(0)?.init;
		let vueObj = exportValue as ObjectExpression;
		if (!vueObj) return [];
		if (
			isCallExpression(exportValue) &&
			isIdentifier(exportValue.callee) &&
			exportValue.callee.name === "defineComponent"
		) {
			vueObj = exportValue.arguments[0] as ObjectExpression;
		}
		if (isObjectExpression(vueObj)) {
			const props = vueObj.properties.find(
				(property) =>
					isObjectProperty(property) &&
					isIdentifier(property.key) &&
					property.key.name === "props"
			) as ObjectProperty;
			if (!props) {
				return [];
			}
			if (isArrayExpression(props.value)) {
				return handleArrayAttr(props.value);
			} else if (isObjectExpression(props.value)) {
				return handleObjectAttr(props.value);
			}
		}
	}
	return [];
}

function traverseVueTags(
	node: VueASTNode,
	customTags: TraversedTag[],
	nativeTags: TraversedTag[]
) {
	const { tag, loc } = node;
	const { start } = loc;
	if (tag) {
		const traverseTag = {
			tag,
			row: start.line,
		};
		transformTraversedTags(traverseTag, customTags);
	}
	if (node.children) {
		for (const child of node.children) {
			traverseVueTags(child, customTags, nativeTags);
		}
	}
	return { customTags, nativeTags };
}

function transformTraversedTags(
	traverseTag: TraversedTag,
	customTags: TraversedTag[]
) {
	const { tag } = traverseTag;
	const isCustomTags = !htmlTags.includes(tag) && !banTags.includes(tag);

	if (isCustomTags) {
		customTags.push(traverseTag);
	}
}

function parseTsx(fileContent: string, filePath: string) {
	const jsxContent = transformSync(fileContent, {
		filename: filePath,
		presets: ["@babel/preset-typescript"],
		plugins: ["@vue/babel-plugin-jsx"],
		comments: false,
	});
	const componentTags: TraversedTag[] = [];
	try {
		const parsedTsx = domParse(jsxContent?.code!, { comments: false });
		const textNodes = parsedTsx?.children.filter(
			(ele) => ele.type === NodeTypes.TEXT
		);

		for (const el of textNodes) {
			const { source } = el.loc;
			const ast = babelParse(source, {
				sourceFilename: filePath,
				sourceType: "module",
				plugins: ["jsx"],
			});

			traverse(ast, {
				CallExpression(path: any) {
					const { node } = path;
					if (
						node.callee?.name?.includes("createVNode") &&
						node.arguments?.length >= 1
					) {
						const stringNodes = node.arguments
							.filter((i: any) => i.type === "StringLiteral")
							.map((i: any) => {
								return { tag: i.value, row: i.loc.start.line };
							});
						const identifierNodes = node.arguments
							.filter((i: any) => i.type === "Identifier")
							.map((i: any) => {
								return { tag: i.name, row: i.loc.start.line };
							});
						componentTags.push(...identifierNodes);
					}
				},
			});
		}
		// if (filePath.endsWith("Home.tsx")) logger.debug({ tags });
	} catch (error) {
		throw error;
	}

	return {
		componentTags,
	};
}

function traverseTsxTag(
	nodes: VueASTNode[],
	nativeTags: TraversedTag[],
	customTags: TraversedTag[]
) {
	nodes.forEach((node) => {
		categorizeTag(node, nativeTags, customTags);
		if (node.children) {
			traverseTsxTag(node.children, nativeTags, customTags);
		}
	});
}

function categorizeTag(
	node: VueASTNode,
	nativeTags: TraversedTag[],
	customTags: TraversedTag[]
) {
	const isNativeTags = htmlTags.includes(node.tag);
	const isCustomTags =
		!htmlTags.includes(node.tag) && !banTags.includes(node.tag);
	const tag = { tag: node.tag, row: node.loc.start.line };

	if (isCustomTags) {
		customTags.push(tag);
	} else if (isNativeTags) {
		nativeTags.push(tag);
	}
}

function getTsxProps(fileContent: string, filePath: string) {
	const jsx = transformSync(fileContent, {
		filename: filePath,
		presets: ["@babel/preset-typescript"],
		comments: false,
	});

	const parsed = babelParse(jsx?.code || "", {
		sourceType: "module",
		plugins: ["jsx"],
	});

	let properties: VueProperty[] = [];
	// const debugNodes: any[] = [];
	traverse(parsed, {
		ExportDeclaration(path: any) {
			// debugNodes.push(path.node);
			properties = getJsxProps(path.node);
		},
	});

	return properties;
}
