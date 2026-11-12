#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <sys/mount.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc != 2) {
        fputs("Usage: run_isolated /path/to/probe-status.ini\n", stderr);
        return 2;
    }

    if (unshare(CLONE_NEWNS) != 0) {
        perror("create private mount namespace");
        return 1;
    }
    if (mount(NULL, "/", NULL, MS_PRIVATE | MS_REC, NULL) != 0) {
        perror("disable mount propagation");
        return 1;
    }
    if (mount(argv[1], "/opt/youtube/status.ini", NULL, MS_BIND, NULL) != 0) {
        perror("mount test configuration");
        return 1;
    }
    if (chdir("/opt/youtube") != 0) {
        perror("open YouTube content directory");
        return 1;
    }

    execl("/usr/local/bin/secure_exec", "secure_exec", "youtube",
          "/opt/youtube/start_youtube.sh", (char *)NULL);
    perror("launch Cobalt under its stock user");
    return 1;
}
