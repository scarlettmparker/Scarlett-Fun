import { Component, createEffect, createSignal, onMount } from "solid-js";
import { Title } from "@solidjs/meta";
import styles from './color.module.css';

/**
 * Helper function to generate all the necessary colours for the game.
 * This works by generating 3 RGB values for a colour and then converting
 * that value into a hex code.
 * 
 * @param count Number of colours to generate.
 * @return String array of hex codes generated.
 */
function generate_colors(count: number): string[] {
  let colors: string[] = [];
  let i;

  for (i = 0; i < count; i++) {
    let hex: string = "#";
    let j;

    // generate color as rgb value and convert to hex
    for (j = 0; j < 3; j++) {
      const rgb_val = Math.floor(Math.random() * 256);
      const hex_val = rgb_val.toString(16).padStart(2, '0');
      hex += hex_val;
    }
    colors[i] = hex;
  }

  return colors;
}

/**
 * Helper function get generate an answer based on the max
 * number of colours generated.
 * 
 * @count Number of colours generated.
 * @return Random value between 0 and colours generated - 1;
 */
function generate_answer(count: number): number {
  const answer = Math.floor(Math.random() * count);
  return answer;
}

const Color: Component = () => {
  const DEFAULT_COLOR_COUNT = 2;

  const [answer, set_answer] = createSignal<number | null>(-1);
  const [best, set_best] = createSignal<number>(0);
  const [correct, set_correct] = createSignal(0);

  const [colors, set_colors] = createSignal<string[]>([]);
  const [winner, set_winner] = createSignal<boolean | null>(null);
  const [message, set_message] = createSignal<string | null>(null);
  const [max_colors, set_max_colors] = createSignal(DEFAULT_COLOR_COUNT);

  // submit a guess
  const guess = (idx: number) => {
    if (idx == answer()) {
      set_message("Correct!");
      set_winner(true);
    } else {
      set_message("Incorrect!");
      set_winner(false);
    }
  }

  // save the best score, add it to local storage as well
  const save_best = () => {
    const best = get_best();
    if (correct() > best) {
      localStorage.setItem("best", correct().toString());
      set_best(correct());
    }
  }

  const get_best = () => {
    const best = localStorage.getItem("best");
    if (best) {
      return parseInt(best);
    }
    return 0;
  }

  const reset_game = () => {
    set_colors(generate_colors(max_colors()));
    set_answer(generate_answer(max_colors()));
    set_winner(null);
    set_message(null);
  }

  // continue the game, set new colours etc etc
  const continue_game = () => {
    set_correct(correct() + 1);
    save_best();
    set_max_colors(max_colors() + 1);
    reset_game();
  }

  const retry_game = () => {
    save_best();
    set_correct(0);
    set_max_colors(DEFAULT_COLOR_COUNT);
    reset_game();
  }

  onMount(() => {
    set_colors(generate_colors(max_colors()));
    set_answer(generate_answer(max_colors()));
    set_best(get_best());
  })

  return (
    <div class={styles.page_wrapper}>
      <Title>Color Game</Title>
      <div class={styles.score_wrapper}>
        <span class={styles.score_text}>Score: {correct()}</span>
        <span class={styles.score_text}>Best: {best()}</span>
      </div>
      <div class={styles.game_wrapper}>
        {(answer() != null && colors().length > 0) &&
          <>
            <div class={styles.answer_box} style={{ "background-color": colors()[answer()!] }}>
              {message() &&
                <>
                  <span class={styles.message}>{message()}</span>
                  {winner() ?
                    <button class={styles.button} onclick={continue_game}>Continue</button>
                    :
                    <button class={styles.button} onclick={retry_game}>Retry</button>
                  }
                </>
              }
            </div>
            <div class={styles.answer_footer}>
              {colors().map((color, idx) => {
                return (
                  <button
                    disabled={winner() !== null}
                    class={(winner() !== null && idx == answer()) ? styles.correct_button : styles.button}
                    onclick={() => guess(idx)}>
                    {color}
                  </button>
                );
              })}
            </div>
          </>
        }
      </div>
    </div>
  );
}

export default Color;