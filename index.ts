import { getInput, getIDToken, setSecret, setOutput } from "@actions/core";
import { HttpClient, HttpCodes } from "@actions/http-client";
import { BearerCredentialHandler } from "@actions/http-client/lib/auth";

class VaultError extends Error {}

async function authenticateToVault({
  httpClient,
  vaultServer,
  authMountpoint,
  authRole,
  githubToken,
}: {
  httpClient: HttpClient;
  vaultServer: string;
  authMountpoint: string;
  authRole?: string;
  githubToken: string;
}): Promise<string> {
  const response = await httpClient.post(
    `${vaultServer}/v1/auth/${authMountpoint}/login`,
    JSON.stringify({ role: authRole, jwt: githubToken }),
  );

  if (response.message.statusCode !== HttpCodes.OK) {
    throw new VaultError(
      `Unexpected response from ${vaultServer}/v1/auth/${authMountpoint}/login when authenticating: ${response.message.statusCode}`,
    );
  }

  const body = JSON.parse(await response.readBody());
  const token = body?.auth?.client_token;

  if (!token) {
    throw new VaultError("Auth token was not present in response from Vault");
  }

  return token;
}

async function obtainK8sCredentials({
  httpClient,
  vaultServer,
  k8sMountpoint,
  k8sRole,
  k8sNamespace,
}: {
  httpClient: HttpClient;
  vaultServer: string;
  k8sMountpoint: string;
  k8sRole: string;
  k8sNamespace?: string;
}): Promise<string> {
  const response = await httpClient.post(
    `${vaultServer}/v1/${k8sMountpoint}/creds/${k8sRole}`,
    JSON.stringify({ kubernetes_namespace: k8sNamespace }),
  );

  if (response.message.statusCode !== HttpCodes.OK) {
    throw new VaultError(
      `Unexpected response from ${vaultServer}/v1/${k8sMountpoint}/creds/${k8sRole} when obtaining k8s credentials: ${response.message.statusCode}`,
    );
  }

  const body = JSON.parse(await response.readBody());
  const token = body?.data?.service_account_token;

  if (!token) {
    throw new VaultError("k8s token was not present in response from Vault");
  }

  return token;
}

const vaultServer = getInput("vault-server", { required: true }).replace(/\/$/, "");
const httpClient = new HttpClient();

getIDToken()
  .then((githubToken) =>
    authenticateToVault({
      httpClient,
      vaultServer,
      authMountpoint: getInput("vault-github-mountpoint", { required: true }),
      authRole: getInput("vault-github-role"),
      githubToken,
    }),
  )
  .then((vaultToken) => {
    const authHandler = new BearerCredentialHandler(vaultToken);
    httpClient.handlers.push(authHandler);
    setSecret(vaultToken);

    return obtainK8sCredentials({
      httpClient,
      vaultServer,
      k8sMountpoint: getInput("vault-k8s-mountpoint", { required: true }),
      k8sRole: getInput("vault-k8s-role", { required: true }),
      k8sNamespace: getInput("vault-k8s-namespace"),
    });
  })
  .then((k8sToken) => {
    setSecret(k8sToken);

    setOutput("kubeconfig", {
      apiVersion: "v1",
      kind: "Config",
      "current-context": "default",
      clusters: [
        {
          name: "default",
          cluster: {
            "certificate-authority-data": btoa(getInput("k8s-controller-ca", { required: true })),
            server: getInput("k8s-controller-url", { required: true }),
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
