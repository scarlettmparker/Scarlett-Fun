import { Component } from "solid-js";
import { Title } from "@solidjs/meta";
import styles from './index.module.css';

const Index: Component = () => {
  return (
    <>
      <Title>Scarlett Parker</Title>
      <span class={styles.construction_text}>
        Home page under construction. While you're here, check out:
        <ul>
          <li>
            <a class={styles.a} href="https://github.com/scarlettmparker/" target="_blank">
              GitHub Page
            </a>
          </li>
          <li>
            <a class={styles.a} href="https://reader.scarlettparker.co.uk/" target="_blank">
              Guided Reader
            </a>
          </li>
          <li>
            <a class={styles.a} href="https://scarlettparker.co.uk/minecraft/">
              Life Series
            </a>
          </li>
          <li>
            <a class={styles.a} href="https://scarlettparker.co.uk/spell/">
              Spell Bee
            </a>
          </li>
        </ul>
      </span>
    </>
  )
};

export default Index;