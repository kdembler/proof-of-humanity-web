import UserSettings from "./user-settings";
import Web3Provider from "./web3-provider";

const metadata = {
  title: "Web3/UserSettings",
  component: UserSettings,
  argTypes: {
    userSettingsURL: {
      type: { name: "string", required: true },
      description: "URL of the user settings API.",
      table: {
        type: {
          summary: "string",
        },
      },
    },
    settings: {
      type: { name: "object", required: true },
      description: "The settings that should be controlled.",
      table: {
        type: {
          summary: "object",
        },
      },
    },
    parseSettings: {
      type: { name: "function", required: true },
      description: "Parser for fetched settings.",
      table: {
        type: {
          summary: "function",
        },
      },
    },
    normalizeSettings: {
      type: { name: "function", required: true },
      description: "Normalizer for updated settings.",
      table: {
        type: {
          summary: "function",
        },
      },
    },
  },
};
export default metadata;

const network = process.env.NEXT_PUBLIC_NETWORK || "mainnet";

function Template(args) {
  return (
    <Web3Provider
      infuraURL={`wss://${network}.infura.io/ws/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`}
    >
      <UserSettings {...args} />
    </Web3Provider>
  );
}

export const Default = Template.bind();
const settings = {
  proofOfHumanityNotifications: {
    label: "Enable",
    info: "Subscribe to updates about submissions you are involved in.",
  },
};
Default.args = {
  userSettingsURL:
    "https://hgyxlve79a.execute-api.us-east-2.amazonaws.com/production/user-settings",
  settings,
  parseSettings(rawSettings) {
    return {
      ...Object.keys(settings).reduce((acc, setting) => {
        acc[setting] =
          rawSettings?.payload?.settings?.Item?.[setting]?.BOOL || false;
        return acc;
      }, {}),
      email: rawSettings?.payload?.settings?.Item?.email?.S || "",
    };
  },
  normalizeSettings({ email, ...rest }) {
    return {
      email: { S: email },
      ...Object.keys(rest).reduce((acc, setting) => {
        acc[setting] = {
          BOOL: rest[setting] || false,
        };
        return acc;
      }, {}),
    };
  },
};
