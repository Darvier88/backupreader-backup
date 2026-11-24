import { NextPage } from "next";
import { RequierePlan } from "../components/ui/RequierePlan";
import { InitialDashboardScreen } from "../components/screens";

const initialDashboard: NextPage = () => {
  return (
    <RequierePlan>
      <InitialDashboardScreen />
    </RequierePlan>
  );
};

export default initialDashboard;
