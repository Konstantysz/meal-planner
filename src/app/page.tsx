import { redirect } from 'next/navigation';

/** Przepisy is the start screen; the plan lives at `/plan`. */
export default function Home() {
  redirect('/recipes');
}
