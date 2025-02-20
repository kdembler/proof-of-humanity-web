import {
  Alert,
  Box,
  Button,
  Card,
  Field,
  FileUpload,
  Form,
  Link,
  List,
  ListItem,
  Progress,
  Text,
  Textarea,
  useArchon,
  useContract,
  useWeb3,
} from "@kleros/components";
import { useField } from "formik";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { graphql, useFragment } from "relay-hooks";

import useIsGraphSynced from "_pages/index/use-is-graph-synced";
import { useEvidenceFile } from "data";

const VIDEO_OPTIONS = {
  types: {
    value: ["video/mp4", "video/webm"],
    label: "*.mp4, *.webm",
  },
  size: {
    value: 7 * 1024 * 1024,
    label: "7 MB",
  },
};

const PHOTO_OPTIONS = {
  types: {
    value: ["image/jpeg", "image/png"],
    label: "*.jpg, *.jpeg, *.png",
  },
  size: {
    value: 2 * 1024 * 1024,
    label: "2 MB",
  },
};

const sanitize = (input) =>
  input
    .toString()
    .toLowerCase()
    .replace(/([^\d.a-z]+)/gi, "-"); // Only allow numbers and aplhanumeric.

const submitProfileCardFragment = graphql`
  fragment submitProfileCard on Contract {
    arbitrator
    arbitratorExtraData
    submissionBaseDeposit
    registrationMetaEvidence {
      URI
    }
  }
`;

function useUploadProgress() {
  const [uploadProgress, _doSetUploadProgress] = useState(0);
  const setUploadProgress = useCallback((event) => {
    _doSetUploadProgress((current) =>
      !current
        ? {
            loaded: event.loaded,
            total: event.total,
          }
        : {
            loaded:
              event.loaded > current.loaded ? event.loaded : current.loaded,
            total: current.total,
          }
    );
  }, []);

  return [uploadProgress, setUploadProgress];
}

function UploadProgress({ total, loaded, label, sx }) {
  return (
    <Box sx={{ ...sx }}>
      {label}
      <Progress
        max={total ?? 1}
        value={loaded ?? 0}
        color={loaded >= total ? "success" : "primary"}
      />
    </Box>
  );
}

function UpdateTotalCost({ totalCost }) {
  const { web3 } = useWeb3();
  const totalCostRef = useRef(totalCost);
  const field = useField("contribution");
  const setValue = field[2].setValue;
  useEffect(() => {
    if (totalCost && totalCostRef.current !== web3.utils.fromWei(totalCost)) {
      totalCostRef.current = web3.utils.fromWei(totalCost);
      setValue(totalCostRef.current);
    }
  }, [totalCost, setValue, web3.utils]);
  return null;
}

export default function SubmitProfileCard({
  contract,
  submission,
  reapply,
  afterSend = () => {},
}) {
  const {
    arbitrator,
    arbitratorExtraData,
    submissionBaseDeposit,
    registrationMetaEvidence,
  } = useFragment(submitProfileCardFragment, contract);

  const { web3 } = useWeb3();
  const [arbitrationCost] = useContract(
    "klerosLiquid",
    "arbitrationCost",
    useMemo(
      () => ({
        address: arbitrator,
        args: [arbitratorExtraData],
      }),
      [arbitrator, arbitratorExtraData]
    )
  );
  const totalCost = useMemo(
    () => arbitrationCost?.add(web3.utils.toBN(submissionBaseDeposit)),
    [arbitrationCost, web3.utils, submissionBaseDeposit]
  );

  const { upload, uploadWithProgress } = useArchon();
  const { receipt, send } = useContract(
    "proofOfHumanity",
    reapply ? "reapplySubmission" : "addSubmission"
  );
  const isGraphSynced = useIsGraphSynced(receipt?.blockNumber);

  const metaEvidence = useEvidenceFile()(registrationMetaEvidence.URI);

  const router = useRouter();

  const handleFormReset = useCallback(() => {
    router.back();
  }, [router]);

  const submissionName = submission?.name ?? "";

  const [photoUploadProgress, setPhotoUploadProgress] = useUploadProgress();
  const [videoUploadProgress, setVideoUploadProgress] = useUploadProgress();

  return (
    <Card
      header="Submit Profile"
      headerSx={{
        backgroundColor: "accent",
        color: "background",
        fontWeight: "bold",
      }}
    >
      <Form
        createValidationSchema={useCallback(
          ({ string, file, eth, web3: _web3 }) => {
            const schema = {
              name: string()
                .max(50, "Must be 50 characters or less.")
                .required("Required")
                .default(submissionName),
              firstName: string()
                .max(20, "Must be 20 characters or less.")
                .matches(
                  /^[\s\w]*$/,
                  "Only letters from a to z and spaces are allowed."
                ),
              lastName: string()
                .max(20, "Must be 20 characters or less.")
                .matches(
                  /^[\s\w]*$/,
                  "Only letters from a to z and spaces are allowed."
                ),
              bio: string().max(70, "Must be 70 characters or less."),
              photo: file()
                .required("Required")
                .test(
                  "fileSize",
                  `Photo should be ${PHOTO_OPTIONS.size.label} or less`,
                  (value) =>
                    !value ? true : value.size <= PHOTO_OPTIONS.size.value
                )
                .test(
                  "fileType",
                  `Photo should be one of the following types: ${PHOTO_OPTIONS.types.label}`,
                  (value) =>
                    !value
                      ? true
                      : PHOTO_OPTIONS.types.value.some((allowedMimeType) => {
                          const [mimeType] = String(value.type)
                            .toLowerCase()
                            .split(";");
                          return mimeType === allowedMimeType;
                        })
                ),
              video: file()
                .required("Required")
                .test(
                  "fileSize",
                  `Video should be ${VIDEO_OPTIONS.size.label} or less`,
                  (value) =>
                    !value ? true : value.size <= VIDEO_OPTIONS.size.value
                )
                .test(
                  "fileType",
                  `Video should be one of the following types: ${VIDEO_OPTIONS.types.label}`,
                  (value) =>
                    !value
                      ? true
                      : VIDEO_OPTIONS.types.value.some((allowedMimeType) => {
                          const [mimeType] = String(value.type)
                            .toLowerCase()
                            .split(";");
                          return mimeType === allowedMimeType;
                        })
                ),
              contribution: eth()
                .test({
                  test(value) {
                    if (totalCost && value.gt(totalCost))
                      return this.createError({
                        message: `You can't contribute more than the base deposit of ${_web3.utils.fromWei(
                          totalCost
                        )} ETH.`,
                      });
                    return true;
                  },
                })
                .test({
                  async test(value) {
                    const [account] = await _web3.eth.getAccounts();
                    if (!account) return true;
                    const balance = _web3.utils.toBN(
                      await _web3.eth.getBalance(account)
                    );
                    if (value.gt(balance))
                      return this.createError({
                        message: `You can't contribute more than your balance of ${_web3.utils.fromWei(
                          balance
                        )} ETH.`,
                      });
                    return true;
                  },
                }),
            };
            if (totalCost)
              schema.contribution = schema.contribution.default(
                _web3.utils.fromWei(totalCost)
              );
            return schema;
          },
          [totalCost, submissionName]
        )}
        onReset={handleFormReset}
        onSubmit={async ({
          name,
          firstName,
          lastName,
          bio,
          photo,
          video,
          contribution,
        }) => {
          [{ pathname: photo }, { pathname: video }] = await Promise.all([
            uploadWithProgress(sanitize(photo.name), photo.content, {
              onProgress: setPhotoUploadProgress,
            }),
            uploadWithProgress(sanitize(video.name), video.content, {
              onProgress: setVideoUploadProgress,
            }),
          ]);
          const { pathname: fileURI } = await upload(
            "file.json",
            JSON.stringify({ name, firstName, lastName, bio, photo, video })
          );
          const { pathname: evidence } = await upload(
            "registration.json",
            JSON.stringify({ fileURI, name: "Registration" })
          );
          const result = await send(evidence, name, {
            value: String(contribution) === "" ? 0 : contribution,
          });

          afterSend?.(result);

          return result;
        }}
      >
        {({ isSubmitting }) => (
          <>
            <Alert type="warning" title="PRIVACY WARNING" sx={{ mb: 3 }}>
              The Ethereum address you are using to submit your profile will be
              publicly linked to your identity. If you don&rsquo;t want your
              wallet holdings and transaction history to be linked to your
              identity, we recommend using a new Ethereum address. To improve
              your privacy, we recommend using an address which is already
              public or a new one-seeded through{" "}
              <Link
                href="https://tornado.cash"
                target="_blank"
                rel="noreferrer noopener"
              >
                tornado.cash
              </Link>
              .
            </Alert>
            <Field
              name="name"
              label="Display Name"
              placeholder="The name you go by"
              readOnly={submissionName !== ""}
              info={
                submissionName !== ""
                  ? "You have set your display name previously, so it cannot be changed"
                  : ""
              }
            />
            <Field
              name="firstName"
              label="First Name"
              placeholder="(In basic Latin)"
            />
            <Field
              name="lastName"
              label="Last Name"
              placeholder="(In basic Latin)"
            />
            <Field as={Textarea} name="bio" label="Short Bio" />
            <Field
              as={FileUpload}
              name="photo"
              label="Face Photo"
              accept="image/*"
              acceptLabel={PHOTO_OPTIONS.types.label}
              maxSizeLabel={PHOTO_OPTIONS.size.label}
              photo
            />
            <Card
              variant="muted"
              sx={{ marginBottom: 2 }}
              header="Photo Instructions:"
            >
              <List>
                <ListItem>
                  The picture should include the face of the submitter facing
                  the camera and the facial features must be visible.
                </ListItem>
                <ListItem>
                  Face should not be covered under heavy make-up, large
                  piercings or masks hindering the visibility of facial
                  features. Headcover not covering the internal region of the
                  face is acceptable (For example, a hijab is acceptable for a
                  submitter but a niqab is not).
                </ListItem>
                <ListItem>
                  It can include items worn daily (ex: headscarf, turban, wig,
                  light makeup, etc) provided they do not violate the previous
                  point. It cannot include special items worn only on special
                  occasions.
                </ListItem>
              </List>
            </Card>
            <Field
              as={FileUpload}
              name="video"
              label="Video (See Instructions)"
              accept="video/*"
              acceptLabel={VIDEO_OPTIONS.types.label}
              maxSizeLabel={VIDEO_OPTIONS.size.label}
              video
            />
            <Card
              variant="muted"
              sx={{ marginBottom: 2 }}
              header="Video Instructions:"
            >
              <List>
                <ListItem>
                  The sign should display in a readable manner the full Ethereum
                  address of the submitter (No ENS; no ellipsis). The sign can
                  be a screen. The submitter must show the sign in the right
                  orientation to be read on the video.
                </ListItem>
                <ListItem>
                  The submitter must say « I certify that I am a real human and
                  that I am not already registered in this registry ».
                  Submitters should speak in their normal voice.
                </ListItem>
                <ListItem>
                  The video quality should be at least 360p, at most 2 minutes
                  long, and in the webm or MP4 format. Lighting conditions and
                  recording device quality should be sufficient to discern
                  facial features and characters composing the Ethereum address
                  displayed.
                </ListItem>
                <ListItem>
                  The quality of the audio should be high enough such that the
                  speaker can be understood clearly.
                </ListItem>
                <ListItem>
                  The face of the submitter should follow the same requirements
                  than for the photo
                </ListItem>
                <ListItem>
                  Be sure that the preview of your video works as expected
                  before funding your submission. Even if your video file format
                  is compatible, the codec inside might not be supported by
                  popular web browsers.
                </ListItem>
              </List>
            </Card>
            <Field
              name="contribution"
              label={({ field }) => (
                <Text>
                  Initial Deposit (ETH)
                  <Button
                    as={Box}
                    variant="secondary"
                    sx={{
                      marginX: 2,
                      ...(totalCost &&
                        field[1].value.replaceAll?.(",", ".") ===
                          web3.utils.fromWei(totalCost) && {
                          backgroundColor: "skeleton",
                        }),
                    }}
                    onClick={() =>
                      field[2].setValue(web3.utils.fromWei(totalCost))
                    }
                  >
                    Self Fund: {totalCost ? web3.utils.fromWei(totalCost) : "-"}
                  </Button>
                  <Button
                    as={Box}
                    variant="secondary"
                    sx={
                      totalCost &&
                      field[1].value.replaceAll?.(",", ".") !==
                        web3.utils.fromWei(totalCost) && {
                        backgroundColor: "skeleton",
                      }
                    }
                    onClick={() => field[2].setValue(web3.utils.toBN(0))}
                  >
                    Crowdfund
                  </Button>
                </Text>
              )}
              placeholder="The rest will be left for crowdfunding."
              type="number"
              sx={({ field }) =>
                totalCost &&
                field[1].value.replaceAll?.(",", ".") ===
                  web3.utils.fromWei(totalCost) && {
                  display: "none",
                }
              }
              info="The deposit is reimbursed after successful registration, and lost after failure. Any amount not contributed now can be put up by crowdfunders later."
            />
            <Card
              variant="muted"
              sx={{ fontSize: 1, marginBottom: 2 }}
              mainSx={{ padding: 0 }}
            >
              <Link newTab href={metaEvidence?.fileURI}>
                <Text>{metaEvidence && "Registration Rules"}</Text>
              </Link>
            </Card>
            <Button
              type="submit"
              loading={isSubmitting || !isGraphSynced}
              disabled={isSubmitting || !isGraphSynced}
              sx={{
                width: "120px",
              }}
            >
              Submit
            </Button>
            <Button
              type="reset"
              variant="outlined"
              disabled={isSubmitting}
              sx={{
                marginLeft: "1rem",
              }}
            >
              Go Back
            </Button>
            <Text sx={{ marginTop: 1 }}>
              Remember to subscribe to email notifications in Account &gt;
              Notifications to be notified of status changes and any potential
              challenge raised against your registration.
            </Text>
            <UpdateTotalCost totalCost={totalCost} />

            {videoUploadProgress || photoUploadProgress ? (
              <Card
                variant="muted"
                sx={{ my: 1 }}
                mainSx={{
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <UploadProgress
                  total={photoUploadProgress?.total}
                  loaded={photoUploadProgress?.loaded}
                  label={<Text sx={{ fontSize: 0 }}>Uploading photo...</Text>}
                  sx={{ width: "100%" }}
                />
                <UploadProgress
                  total={videoUploadProgress?.total}
                  loaded={videoUploadProgress?.loaded}
                  label={<Text sx={{ fontSize: 0 }}>Uploading video...</Text>}
                  sx={{ width: "100%" }}
                />
              </Card>
            ) : null}
          </>
        )}
      </Form>
    </Card>
  );
}
