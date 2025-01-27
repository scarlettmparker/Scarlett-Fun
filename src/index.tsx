import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { MetaProvider } from "@solidjs/meta";

import Index from "./routes";
import Color from "./routes/color";
import Minecraft from "./routes/minecraft";
import Spell from "./routes/spell";
import StemPlayer from "./routes/stemplayer";

import './index.css';

render(
  () => (
    <MetaProvider>
      <Router>
        <Route path="/" component={Index} />
        <Route path="/color" component={Color} />
        <Route path="/minecraft" component={Minecraft} />
        <Route path="/spell" component={Spell} />
        <Route path="/stemplayer" component={StemPlayer} />
       </Router>
    </MetaProvider>
  ),
  document.getElementById("root")!
);