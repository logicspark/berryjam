# Contributing

First and foremost, thank you for considering contributing to Berryjam. Contributors like you helps to make Berryjam better and more valuable to Vue.js developers :rocket:

All contributions are welcome, any contribution you make helps us to build and grow Berryjam!

Here are some ideas of what you can contribute:

- Submitting bug reports

- Feature requests

- Improving the documentation

- Writing a blog/post or tutorials about Berryjam

- Providing examples of how Berryjam can be used

- Writing codes that can be incorporated into Berryjam or unit tests

- Help others in [Berryjam Discord](https://discord.gg/8SgTS4QdCd)

## Ground Rules

The goal is to maintain a diverse community that's pleasant for everyone. That's why we would greatly appreciate it if everyone contributing to and interacting with the community also followed this [Code of Conduct](/CODE_OF_CONDUCT.md).

## Understanding Issue Labels

Issues are tagged with labels, as described in the following table:

| Label              | Description                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `bug`              | Places where Berryjam is not working like how it is designed. Bug can be small or large in scope.           |
| `documentation`    | Content that needs to be added, tutorial or examples of how Berryjam can be used                            |
| `enhancement`      | Suggestions to improve Berryjam by modifying existing or adding new functionality                           |
| `good first issue` | Issues that we believe are relatively straightforward to tackle. Good for newcomers.                        |
| `help wanted`      | May require specific expertise or knowledge. Usually more challenging but would be a great help.            |
| `rule`             | An issue to explain how Vue components can be created or how to use props that are not covered in the docs. |

_Remark: For issues with simple non-code changes like fixing a typo in documentation, these changes can often be submitted as a Pull Request directly without needing to fork and clone._

## Your First Contribution

New to Berryjam? Unsure where to start contributing? Start here:

We recommend going to the GitHub [Issues](../../issues) tab to find issues that interest you. Unassigned issues labelled documentation and [good first issue](../../labels/good%20first%20issue) are usually good for newer contributors.

### First Time Contributing?

If you are a first-time contributor, here are a couple of resources to help you get started:

- https://github.com/firstcontributions/first-contributions

- http://www.firsttimersonly.com/

- https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github

If you have any questions, feel free to ask for help in [Berryjam Discord](https://discord.gg/8SgTS4QdCd). Everyone is a beginner at first :smile_cat:

## Where to ask questions

We welcome you to join us on our [discord](https://discord.gg/8SgTS4QdCd) to ask questions, consult or discuss Berryjam related topics with the core team and other community members.

## How to report a bug

If you found a bug, you can help us by submitting an issue to our GitHub Repository. Even better, you can submit a Pull Request with a fix.

However, if you find a security vulnerability, do **_NOT_** open an issue. Email security@berryjam.dev instead. You may check out our [Security Guidelines](/SECURITY.md) for more details.

## How to request a feature

We welcome and appreciate any feature requests. If there are new features that you would like to see, you can request it directly [here](../../issues/new?assignees=&labels=enhancement&projects=&template=feature_request.yml&title=✨+) by describing the feature you would like to see, why you need it, and how it should work.

## How to take on an issue

Once you’ve found an interesting issue, it is a good idea to assign the issue to yourself to avoid duplication works. If for whatever reason you are unable to continue working on the issue, please unassign so others know it is available and may continue where you left off. If you wish to work on an assigned issue, please kindly ask the current assignee if you can work on it.

## How to contribute without back-end experience

If you are a Vue.js developer but is not comfortable contributing with Node.js. Don’t worry! You can contribute by provide code examples on how to name components, create components or use props in different ways. For more information on what the library covers, please refer to our [built-in-rules](/documentation/built-in-rules).

## How do I make a code contribution?

For contributions to new issues or something bigger than a one or two line fix, please follow the steps below.

### Prerequisite

Please ensure the `npm` version is >= 9.5.1 while the `node` version is >=18.16.1 and should be a long-term support (LTS) version.

### Step 1: Fork and Clone Berryjam repository

To start making changes to the codes, please fork Berryjam to make your own copy. At the top of Berryjam Github page, click on the `Fork` button to fork the repo.

Then, clone your fork to your machine.

```sh
cd your-prefered-directory
git clone https://github.com/{your-github-user-name}/berryjam.git
```

This creates the directory `berryjam` in your machine.

### Step 2: Install Berryjam's dependencies

To ensure that the codes will work properly, please install Berryjam's dependencies. Our preference is to use `pnpm` as a node package manager. Here is the example install Berryjam via pnpm.

```sh
cd berryjam
pnpm i
```

### Step 3: Create a branch

Create a new branch for your changes. To maintain uniformity and clarity in branch names, please adhere to the following naming conventions. In general, it's advisable to include a group/type prefix in your branch name. Here is a list of recommended examples:

- for features: feat/{ISSUE_NO}-{ANY_TITLE} for e.g. feat/1144-detect-unused-components
- for bugs: fix/{ISSUE_NO}-{ANY_TITLE} for e.g. fix/9878-fix-scan-jsx
- for documentation: docs/{ISSUE_NO}-{ANY_TITLE} for e.g. docs/2233-update-readme

```git
git checkout -b your-branch-name
```

Please keep any changes in this branch specific to one issue so it is easy to keep track. You can have many feature branches and switch in between them using the git checkout command.

### Step 4: Make the changes to your branch

For each code change you make, please follow this 2-step process:

1. Add and commit the change

- Stage the changes that are ready to be committed:

```git
git add path/to/file-to-be-added-or-changed
```
- Commit the changes with a short message. For more details on how we [structure](#Git-Commit-Messages) commit messages

```git
git commit -m "<type>(optional scope): <subject>"
```
_Remark: Depending on the impact of your changes to codebase, please write unit tests and run them to make sure they are working as expected before committing the changes._

2. Push the changes to your branch:

When you want your changes to be visible on your GitHub page, push your forked feature branch’s commits

```git
git push origin your-branch-name
```

### Step 5: Submit a pull request to Berryjam repository

Now that your code is on GitHub, but it is not yet a part of Berryjam. For that to happen, a pull request needs to be submitted on GitHub. Here is how you can submit a pull request:

1. Navigate to your repository on GitHub and click on the `Compare & pull request` button
2. Write a title with a short description. Please include the issue number associated with your change. Explain the changes that you made, any possible issues relating to the change you made, and any questions you have.
3. Click `Send Pull Request` button

Please wait for the pull request to be reviewed by a maintainer. If the reviewing maintainer recommends any modifications to your pull request, please kindly do so. Once again, thank you for your contribution :tada:


### Git Commit Messages

We structure our commit messages like this:

```git
<type>(optional scope): <subject>
```

Here are some of the available `<type>`:

| Type       | Description                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `feat`     | New feature                                                                                             |
| `bug`      | Bug fix                                                                                                 |
| `docs`     | Changes to the documentation                                                                            |
| `style`    | Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.) |
| `refactor` | Changes to the codebase that does not fix a bug or adds a feature                                       |
| `perf`     | Changes to the codebase that improves the library performance                                           |
| `test`     | Adds missing or revising existing tests                                                                 |
| `chore`    | Changes to the build process or auxiliary tools, dependencies or libraries                              |

#### Commit Message Example

```
refactor(nuxt): improve on code readability of nuxt scan
```

### Code Guidelines

For guideline on coding such as code formatting and linter, please refer to [.prettierrc](/.prettierrc) and [.eslintrc](/.eslintrc) files.

#### Naming Conventions:

We follow the below naming conventions in our codes:

1. Variables: Use camelCase - `thisIsAVariable`
2. Constants: Use UPPER_SNAKE_CASE - `THIS_IS_A_CONSTANT`
3. Classes & Interface: Use PascalCase - `ThisIsAClass`
4. Type Aliases: Use PascalCase - `ThisIsAType`
5. Files: Use kebab-case - `this-is-a-file`
6. Directories: Use lowercase or kebab-case - `thisisadirectory` or `this-is-a-directory`
