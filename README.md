<div align="center">
  <a href="https://www.berryjam.dev/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/img/berryjam_logo_dark.png" width="500">
      <img alt="Berryjam" src="./assets/img/berryjam_logo_light.png" width="500">
    </picture>
  </a>
</div>

<h1 align="center">UI Components Anaylzer for Vue 3 & Nuxt</h1>

<div align="center">
  Scan your Vue.js codebase for component visibility and actionable insights.
</div>

<p align="center">
  <br/>
  <a href="https://docs.berryjam.dev" rel="dofollow"><strong>Explore the docs »</strong></a>
  <br />
</p>

<div align="center">
  
  [Quick Start (to Web Documentation)][documentation] - [Community](#busts_in_silhouette-community) - [Support (to Berryjam Discord)][discord] - [License](#books-license)
  
  Available in: Vue.js (3.X), Nuxt (3.X)
  
  [![License](https://img.shields.io/badge/license-ELv2-brightgreen)](LICENSE.md)
  [![Discord](https://img.shields.io/discord/1103946598981054514?label=discord)][discord]
  [![Twitter](https://img.shields.io/twitter/follow/berryjamdev?label=Berryjamdev&style=social)][twitter] 
</div>

## :sparkles: Description
Berryjam is a Vue.js component analytics tool to scan your project for components to monitor their usage. Component visibility allows for effective team communication and provides opportunities to optimize your source code.

## :sunglasses: How It Works

Berryjam scans for components in your source code to output a JSON file.

<details>
  <summary>Simple JSON</summary>

```javascript
[
    {
        tag: "Overlay",
        total: 1,
        type: "internal",
        source: {
            filePath: "@/components/ui/Overlay.vue",
            fileProperty: {
                dataLastModified: "",
                lastModified: "",
                created: "",
                createdBy: "",
                updatedBy: ""
            }
        },
        details: [
            {
                source: "/Users/name/folder/koel-master/resources/assets/js/App.vue",
                rows: [2],
                property: {
                    dataLastModified: "",
                    lastModified: "",
                    created: "",
                    createdBy: "",
                    updatedBy: ""
                },
                total: 1,
            },
        ],
        children: {
            total: 0,
            tags: [],
            source: "",
        },
    },
    {
        tag: "DialogBox",
        total: 1,
        type: "internal",
        source: {
            filePath: "@/components/ui/DialogBox.vue",
            fileProperty: {
                dataLastModified: "",
                lastModified: "",
                created: "",
                createdBy: "",
                updatedBy: ""
            }
        },
        details: [
            {
                source: "/Users/name/folder/koel-master/resources/assets/js/App.vue",
                rows: [3],
                property: {
                    dataLastModified: "",
                    lastModified: "",
                    created: "",
                    createdBy: "",
                    updatedBy: ""
                },
                total: 1,
            },
        ],
        children: {
            total: 0,
            tags: [],
            source: "",
        },
    },
];
```

</details>
After the scan, Berryjam launches an Analytic Dashboard in your web browser for transparency and insights.Here is a sample Dashboard:

![berryjam - dashboard](./assets/img/berryjam-dashboard.svg)

## :busts_in_silhouette: Community

- [Twitter][twitter]: Follow our official Twitter account
- [Discord][discord]: A place where you can get support, feedback or just want to meet and hang out.
- [GitHub](https://github.com/logicspark/berryjam): If you wish, you may want to request features here too.
- For any other inquiries, you may reach out to us at connect@berryjam.dev.

## :books: License

Berryjam code is licensed under the terms of the [Elastic License 2.0](LICENSE.md) (ELv2), which means you can use it freely inside your organization to protect your applications without any commercial requirements.

You are not allowed to provide Berryjam to third parties as a hosted or managed service without explicit approval.

---

[discord]: https://discord.gg/8SgTS4QdCd
[twitter]: https://twitter.com/Berryjamdev
[documentation]: https://docs.berryjam.dev
