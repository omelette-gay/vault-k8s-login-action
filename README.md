# vault-k8s-login-action

Authenticates to Vault using a GitHub token in order to load credentials for a Kubernetes cluster

## Dev quick start

- Have Node 20 installed
- `npm install`
- `npm test`

To build this, we'll need to commit node_modules and also the built index.js file - these are not committed to main
by default. So to prepare a release:

Edit the version in package.json, then

```shell
npm install
rm -f .gitignore
npm run build
npm prune --production
git add index.js node_modules
git commit -am "release v$(jq -r .version < package.json)"
git tag v$(jq -r .version < package.json)
git tag -f v$(jq -r .version < package.json | cut -d. -f1)
git push -f --tags
git reset --hard origin/main
```
