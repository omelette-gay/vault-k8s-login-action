"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const http_client_1 = require("@actions/http-client");
class VaultError extends Error {
}
async function authenticateToVault({ httpClient, vaultServer, authMountpoint, authRole, githubToken, }) {
    const response = await httpClient.post(`${vaultServer}/v1/auth/${authMountpoint}/login`, JSON.stringify({ role: authRole, jwt: githubToken }));
    if (response.message.statusCode !== http_client_1.HttpCodes.OK) {
        throw new VaultError(`Unexpected response (${response.message.statusCode}) from ${vaultServer}/v1/auth/${authMountpoint}/login when authenticating: ${await response.readBody()}`);
    }
    const body = JSON.parse(await response.readBody());
    const token = body?.auth?.client_token;
    if (!token) {
        throw new VaultError("Auth token was not present in response from Vault");
    }
    return token;
}
async function obtainK8sCredentials({ httpClient, vaultServer, vaultToken, k8sMountpoint, k8sRole, k8sNamespace, }) {
    const response = await httpClient.post(`${vaultServer}/v1/${k8sMountpoint}/creds/${k8sRole}`, JSON.stringify({ kubernetes_namespace: k8sNamespace }), { authorization: `Bearer ${vaultToken}` });
    if (response.message.statusCode !== http_client_1.HttpCodes.OK) {
        throw new VaultError(`Unexpected response (${response.message.statusCode}) from ${vaultServer}/v1/${k8sMountpoint}/creds/${k8sRole} when obtaining k8s credentials: ${await response.readBody()}`);
    }
    const body = JSON.parse(await response.readBody());
    const token = body?.data?.service_account_token;
    if (!token) {
        throw new VaultError("k8s token was not present in response from Vault");
    }
    return token;
}
const vaultServer = (0, core_1.getInput)("vault-server", { required: true }).replace(/\/$/, "");
const httpClient = new http_client_1.HttpClient();
(0, core_1.getIDToken)()
    .then((githubToken) => authenticateToVault({
    httpClient,
    vaultServer,
    authMountpoint: (0, core_1.getInput)("vault-github-mountpoint", { required: true }),
    authRole: (0, core_1.getInput)("vault-github-role"),
    githubToken,
}))
    .then((vaultToken) => {
    (0, core_1.setSecret)(vaultToken);
    return obtainK8sCredentials({
        httpClient,
        vaultServer,
        vaultToken,
        k8sMountpoint: (0, core_1.getInput)("vault-k8s-mountpoint", { required: true }),
        k8sRole: (0, core_1.getInput)("vault-k8s-role", { required: true }),
        k8sNamespace: (0, core_1.getInput)("vault-k8s-namespace"),
    });
})
    .then((k8sToken) => {
    (0, core_1.setSecret)(k8sToken);
    (0, core_1.setOutput)("kubeconfig", {
        apiVersion: "v1",
        kind: "Config",
        "current-context": "default",
        clusters: [
            {
                name: "default",
                cluster: {
                    "certificate-authority-data": btoa((0, core_1.getInput)("k8s-controller-ca", { required: true })),
                    server: (0, core_1.getInput)("k8s-controller-url", { required: true }),
                },
            },
        ],
        contexts: [{ name: "default", context: { cluster: "default", user: "default" } }],
        preferences: {},
        users: [
            {
                name: "default",
                user: { token: k8sToken },
            },
        ],
    });
});
