# Your first renderview deployment on Google Cloud

You can run renderview on your computer before opening a cloud account. Cloud deployment is optional until you want a hosted service.

## 1. Create the account and billing profile

1. Open [Google Cloud's signup page](https://cloud.google.com/free) and sign in with your Google account.
2. Follow the identity and billing verification steps. Review the offer shown for your country and account. Google describes trial eligibility and billing behavior in its [Free Program guide](https://docs.cloud.google.com/free/docs/free-cloud-features).
3. Open the [Cloud Console](https://console.cloud.google.com/). Use the project selector at the top to create a new project named **renderview**.
4. Record the **project ID**, which is unique and may differ from the display name. Link the project to your billing account under **Billing → My projects**.
5. Under **Billing → Budgets & alerts**, create a small budget with email alerts. A budget is an alert, not a spending cap. Running Chromium, builds, stored container images, and network use can incur costs; do not assume the app will always fit a free allowance.

## 2. Open Cloud Shell and upload the project

Click the terminal icon in the console to activate **Cloud Shell**. It already includes the Google Cloud CLI. Upload the `renderview-source.zip` archive, then:

```bash
unzip renderview-source.zip
cd renderview
export GOOGLE_CLOUD_PROJECT="REPLACE-WITH-YOUR-PROJECT-ID"
export REGION="asia-south1"
gcloud config set project "$GOOGLE_CLOUD_PROJECT"
```

`asia-south1` is Mumbai, a useful starting point for India. You may choose another supported region. Save your choice and use the same region in subsequent commands.

If using a GitHub repository instead, clone it in Cloud Shell and enter the repository directory. If running locally, [install the Google Cloud CLI](https://cloud.google.com/sdk/docs/install), run `gcloud auth login`, and use the same commands below.

## 3. Enable services and prepare identities

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com

gcloud iam service-accounts create renderview-runtime \
  --display-name="renderview browser runtime"
```

Leave the runtime identity without project roles; the app only needs internet access. If the account already exists, skip its creation.

Grant the build account its documented build role:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$GOOGLE_CLOUD_PROJECT" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.builder"
```

Allow a few minutes for permissions to propagate. Project owners can normally complete this setup. In a managed organization, ask the administrator for the deployer permissions described in Google's [source deployment guide](https://docs.cloud.google.com/run/docs/deploying-source-code). That guide also covers projects using a custom build account.

## 4. Deploy

From the project directory:

```bash
bash scripts/deploy.sh
```

The script uploads source and builds the included Dockerfile using Cloud Build; local Docker is unnecessary. Accept creation of the source-deploy Artifact Registry repository if prompted. The first build downloads Chromium and can take several minutes. Google documents the Dockerfile-based flow in [Deploy from source](https://docs.cloud.google.com/run/docs/deploying-source-code).

On success, Cloud Run prints a service URL. This deployment is **private**. Opening that URL directly without authentication may return 403; that is expected.

## 5. Open your private dashboard

Grant your account permission to invoke the service:

```bash
ACCOUNT_EMAIL="$(gcloud config get-value account)"
gcloud run services add-iam-policy-binding renderview \
  --region "$REGION" \
  --member="user:${ACCOUNT_EMAIL}" \
  --role="roles/run.invoker"

gcloud run services proxy renderview \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --region "$REGION" \
  --port 8080
```

Keep this command running. In Cloud Shell, select **Web Preview → Preview on port 8080**. When using the CLI locally, visit **http://localhost:8080**. The proxy adds your Google authentication for browser and API requests. See [Authenticate developers](https://docs.cloud.google.com/run/docs/authenticating/developers).

## 6. Verify the deployment

- Open the sample report and switch through its four views.
- Analyze `https://example.com/`; confirm the label changes to **LIVE REPORT**.
- Verify the source and rendered values, timeline, script table, and JSON export.
- Try `http://127.0.0.1`; the app should reject it.
- Open **Cloud Run → renderview → Logs** if a capture fails. Some websites block cloud browsers or require login/consent.

## Updates and costs

Redeploy with `bash scripts/deploy.sh` after pulling changes. It creates a new revision. The initial setup uses zero minimum instances, two maximum instances, and one concurrent request per instance. A cold browser can take time to start; multiple users may need to retry. Rebuild regularly to pick up Node/OS fixes and deliberately update Playwright with its matching browser.

To stop hosting, delete the service:

```bash
gcloud run services delete renderview --region "$REGION"
```

Also review stored images in Artifact Registry and build artifacts, which can remain after service deletion. Delete the dedicated project from **IAM & Admin → Settings → Shut down** if you no longer need any of its resources.

## Common setup issues

| Symptom                       | Next step                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Billing disabled              | Link an active billing account to the selected project.                                             |
| Build permission denied       | Check the actual build identity and its `roles/run.builder` grant; wait for propagation.            |
| Cannot act as service account | Grant the deployer Service Account User on `renderview-runtime`, per the source-deploy guide.       |
| 403 at the service URL        | Use the authenticated proxy; confirm your Cloud Run Invoker role.                                   |
| Chromium unavailable          | Verify the Dockerfile build completed its `playwright install --with-deps chromium` step.           |
| 429 from the API              | Another capture occupies the instance. Retry after the reported delay.                              |
| A particular site fails       | Check response status, access requirements, timing, and resource limits; test a simpler public URL. |
