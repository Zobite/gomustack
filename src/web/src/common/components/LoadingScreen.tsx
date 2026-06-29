import { Spin } from "antd";

export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-canvas">
      <Spin size="large" />
    </div>
  );
}
