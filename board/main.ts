import { mount } from 'svelte';
import './board.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('board')! });
