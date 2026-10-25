// Keep the public version fixed while distinguishing explicitly published builds.
function isNewPrereleaseBuild(info, build) {
  return (
    info.version === "0.0.1" &&
    typeof build?.revision === "string" &&
    typeof info.releaseName === "string" &&
    /^AutostacGIS build [a-f0-9]{20}$/.test(info.releaseName) &&
    info.releaseName !== `AutostacGIS build ${build.revision}` &&
    Date.parse(info.releaseDate) > Date.parse(build.builtAt)
  );
}
function prereleaseUpdater(Base, build) {
  return new (class extends Base {
    async isUpdateAvailable(info) {
      if (
        this.currentVersion.version === "0.0.1" &&
        isNewPrereleaseBuild(info, build)
      ) {
        return (
          (await this.isUpdateSupported(info)) &&
          (await this.isUserWithinRollout(info))
        );
      }
      return super.isUpdateAvailable(info);
    }
  })();
}
module.exports = { isNewPrereleaseBuild, prereleaseUpdater };
