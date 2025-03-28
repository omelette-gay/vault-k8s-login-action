# vault-k8s-login-action

Authenticates to Vault using a GitHub token in order to load credentials for a Kubernetes cluster

## Dev quick start

- Have Node 20 installed
- `npm install`
- `npm test`

To build this, we'll need to commit node_modules and also the built index.js file - these are not committed to main
by default. So to prepare a release:

- Edit the version in package.json
- `npm install`
- `rm -f .gitignore`
- `npm run build`
- `git commit -a "release v1.x.x"`
- `git tag v1.x.x`
- `git tag -f v1`
- `git push -f --tags`
