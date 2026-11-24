import { NextPage } from "next";
import { RequierePlan } from "../components/ui/RequierePlan";

import { DashboardMain } from "../components/screens/DashboardMain";

const dashboard: NextPage = () => {
  return (
    <RequierePlan>
      <DashboardMain />
    </RequierePlan>
  );
};

export default dashboard;
