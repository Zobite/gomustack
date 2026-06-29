import { AllCommunityModule } from "ag-grid-community";
import { AgGridProvider } from "ag-grid-react";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { BrowserRouter } from "react-router-dom";
import { useAuthInit } from "./common/hooks/useAuthInit";
import { AppRoutes } from "./router";

const agGridModules = [AllCommunityModule];

function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          /* Brand — ink-dark dominant, orange scarce */
          colorPrimary: "#26251e",
          colorSuccess: "#1f8a65",
          colorWarning: "#c08532",
          colorError: "#cf2d56",
          colorInfo: "#9fbbe0",
          colorLink: "#26251e",
          colorLinkHover: "#5a5852",

          /* Shape */
          borderRadius: 8,

          /* Typography */
          fontFamily: "'Inter', system-ui, 'Helvetica Neue', Helvetica, Arial, sans-serif",

          /* Surfaces — warm cream canvas, white cards */
          colorBgContainer: "#ffffff",
          colorBgElevated: "#ffffff",
          colorBgLayout: "#f7f7f4",

          /* Hairlines */
          colorBorder: "#e6e5e0",
          colorBorderSecondary: "#efeee8",

          /* Text — warm ink tones */
          colorText: "#5a5852",
          colorTextSecondary: "#807d72",
          colorTextTertiary: "#a09c92",
          colorTextHeading: "#26251e",

          /* Focus ring — remove */
          controlOutline: "transparent",
        },
        components: {
          Table: {
            headerBg: "#f7f7f4",
            headerColor: "#807d72",
            borderColor: "#efeee8",
            rowHoverBg: "#fafaf7",
          },
          Modal: {
            contentBg: "#ffffff",
            headerBg: "#ffffff",
          },
          Input: {
            colorBgContainer: "#ffffff",
            activeBorderColor: "#26251e",
            hoverBorderColor: "#cfcdc4",
            activeShadow: "none",
          },
          Select: {
            colorBgContainer: "#ffffff",
            optionSelectedBg: "#efeee8",
            optionSelectedColor: "#26251e",
            optionActiveBg: "#f7f7f4",
          },
          InputNumber: {
            activeShadow: "none",
          },
          Button: {
            primaryShadow: "none",
          },
          Tag: {
            defaultBg: "#e6e5e0",
            defaultColor: "#5a5852",
          },
          Form: {
            labelColor: "#807d72",
            verticalLabelPadding: "0 0 18px",
            itemMarginBottom: 20,
          },
        },
      }}
    >
      <AntApp>
        <AgGridProvider modules={agGridModules}>
          <BrowserRouter basename="/ui">
            <AuthInitializer>
              <AppRoutes />
            </AuthInitializer>
          </BrowserRouter>
        </AgGridProvider>
      </AntApp>
    </ConfigProvider>
  );
}
