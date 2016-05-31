'use babel';

import { CompositeDisposable } from 'atom';
import { check_access, read_config, exec, signal_name } from './util'
import DebuggerView from './debugger-view'
import Byebug from './byebug'

const subscriptions = new CompositeDisposable();
let view = null;
let term = null;
let byebug = null;

export function activate( /*state*/ ) {
  // Register commands
  register_command(toggle, 'toggle');
  register_command(run, 'run');
  register_command(configure, 'configure');
  register_command(next, 'next');
  register_command(step, 'step');

  // Create view
  view = new DebuggerView();
  view.visible = false;
  view.addToPanel('bottom');
  view.on(DebuggerView.EVENT.RUN, run);
  view.on(DebuggerView.EVENT.STOP, stop);
  view.on(DebuggerView.EVENT.NEXT, next);
  view.on(DebuggerView.EVENT.STEP, step);
  view.on(DebuggerView.EVENT.CONFIGURE, configure);
}

export function deactivate() {
  view.destroy();
  view = null;
  subscriptions.dispose();
}

export function toggle() {
  view.visible = !view.visible;
}

export function run() {
  if (!view.visible) {
    view.visible = true;
  }

  if (term) {
    return;
  }

  // TODO: handle several paths
  const path = atom.project.getPaths()[0];
  const config_path = `${path}/.byebug-debugger`;
  const config_file = `${config_path}/config.json`

  if (!check_access(config_file, 'r')) {
    alert('Configuration file is not readable or does not exist');
    return;
  }

  const config = read_config(config_file);

  if (!config.executable) {
    alert('Configuration does not define any executable');
    return;
  }

  const executable = `${config_path}/${config.executable}`

  if (!check_access(executable, 'x')) {
    alert('Configured executable has no execution permissions');
    return;
  }

  on_debug_starting();
  term = exec(config_path, executable, config.arguments);
  setTimeout(() => {
    byebug = new Byebug().connect();

    view.debugger.clear();
    byebug.on(Byebug.EVENT.RECEIVED, (line) => {
      view.debugger.print(`${line}\n`);
    });
    byebug.on(Byebug.EVENT.SENT, (data) => {
      view.debugger.print(`${data}\n`);
    });
  }, 2000);

  view.output.clear();
  term.on('data', (data) => {
    view.output.print(data);
  });

  term.on('exit', (code, signal) => {
    on_debug_stopping();

    if (signal == 0) {
      view.output.print(
        '<hr>' +
        `<div class="exit_message ${code==0 ? 'success' : 'error'}">` +
        `Process exited with code ${code}` +
        '</div>'
      );
    } else {
      view.output.print(
        '<hr>' +
        '<div class="exit_message warning">' +
        `Process exited with signal ${signal_name(signal)} (${signal})` +
        '</div>'
      );
    }

    term = null;
    byebug = null;
  });
}

export function configure() {
  alert('configure');
}

export function next() {
  if (byebug) {
    byebug.next();
  }
}

export function step() {
  if (byebug) {
    byebug.step();
  }
}

export function stop() {
  if (term) {
    term.destroy();
  }
}

function on_debug_starting() {
  view.enable_button('run', false);
  view.enable_button('next', true);
  view.enable_button('step', true);
  view.enable_button('stop', true);
}

function on_debug_stopping() {
  view.enable_button('run', true);
  view.enable_button('next', false);
  view.enable_button('step', false);
  view.enable_button('stop', false);
}

function register_command(method, cmd) {
  subscriptions.add(
    atom.commands.add(
      'atom-workspace', `byebug-debugger:${cmd}`, method
    )
  );
}