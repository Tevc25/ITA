declare module "mfe_auth/App" {
  import { ComponentType } from "react";
  import type { AuthMfeProps } from "@shared/contracts";

  const App: ComponentType<AuthMfeProps>;
  export default App;
}

declare module "mfe_parking/App" {
  import { ComponentType } from "react";
  import type { ParkingMfeProps } from "@shared/contracts";

  const App: ComponentType<ParkingMfeProps>;
  export default App;
}

declare module "mfe_reservations/App" {
  import { ComponentType } from "react";
  import type { ReservationsMfeProps } from "@shared/contracts";

  const App: ComponentType<ReservationsMfeProps>;
  export default App;
}
