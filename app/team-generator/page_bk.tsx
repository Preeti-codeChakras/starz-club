"use client";


import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";


type Season = {
  id: string;
  name: string;
  active: boolean;
};


type Team = {
  id: string;
  name: string;
};


type SeasonTeamRow = {
  team_id: string;
  teams:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};


type GeneratorPlayer = {
  member_id: string;
  player_name: string;
  primary_role: string | null;
  secondary_role: string | null;
  batting_rating: number | null;
  bowling_rating: number | null;
  fielding_rating: number | null;
  can_keep_wickets: boolean;
  captain_eligible: boolean;
  total_weekends: number;
  response_count: number;
  available_count: number;
  tentative_count: number;
  unavailable_count: number;
  weighted_availability_percentage: number;
};


type GeneratedTeam = {
  team: Team;
  players: GeneratorPlayer[];
  battingTotal: number;
  bowlingTotal: number;
  fieldingTotal: number;
  availabilityTotal: number;
  wicketkeeperCount: number;
  captainEligibleCount: number;
};


type CandidateResult = {
  teams: GeneratedTeam[];
  score: number;
};


type GeneratedOption = {
  id: string;
  teams: GeneratedTeam[];
  rawScore: number;
  fairnessPercentage: number;
};


type BuilderMode = "balanced" | "custom";


type CustomAssignments = Record<string, string>;


const DEFAULT_RATING = 3;
const NUMBER_OF_OPTIONS = 3;
const GENERATION_ATTEMPTS = 1500;


export default function TeamGeneratorPage() {
  const { profile, loadingProfile } =
    useCurrentProfile();


  const isAdmin = profile?.appRole === "Admin";


  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] =
    useState("");


  const [seasonTeams, setSeasonTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<GeneratorPlayer[]>(
    []
  );


  const [builderMode, setBuilderMode] =
    useState<BuilderMode>("balanced");


  const [generatedOptions, setGeneratedOptions] =
    useState<GeneratedOption[]>([]);


  const [activeOptionIndex, setActiveOptionIndex] =
    useState(0);


  const [customAssignments, setCustomAssignments] =
    useState<CustomAssignments>({});


  const [customBuilderStarted, setCustomBuilderStarted] =
    useState(false);


  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [savingFinalTeams, setSavingFinalTeams] =
  useState(false);


  const selectedSeason = useMemo(
    () =>
      seasons.find(
        (season) => season.id === selectedSeasonId
      ) ?? null,
    [seasons, selectedSeasonId]
  );


  const activeOption =
    generatedOptions[activeOptionIndex] ?? null;


  const generatedTeams = activeOption?.teams ?? [];


  const customTeams = useMemo(
    () =>
      buildTeamsFromCustomAssignments(
        players,
        seasonTeams,
        customAssignments
      ),
    [players, seasonTeams, customAssignments]
  );


  const unassignedPlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          !customAssignments[player.member_id]
      ),
    [players, customAssignments]
  );


  const customRawScore = useMemo(
    () =>
      customBuilderStarted
        ? calculateFairnessScore(customTeams)
        : 0,
    [customBuilderStarted, customTeams]
  );


  const customFairnessPercentage = useMemo(
    () =>
      customBuilderStarted
        ? convertRawScoreToStandaloneFairness(
            customRawScore,
            customTeams,
            players.length
          )
        : 0,
    [
      customBuilderStarted,
      customRawScore,
      customTeams,
      players.length,
    ]
  );


  const playersWithIncompleteAvailability = useMemo(
    () =>
      players.filter(
        (player) =>
          Number(player.response_count) <
          Number(player.total_weekends)
      ),
    [players]
  );


  const playersWithMissingRatings = useMemo(
    () =>
      players.filter(
        (player) =>
          player.batting_rating === null ||
          player.bowling_rating === null ||
          player.fielding_rating === null
      ),
    [players]
  );


  const availableWicketkeepers = useMemo(
    () =>
      players.filter(
        (player) => player.can_keep_wickets
      ).length,
    [players]
  );


  const availableCaptains = useMemo(
    () =>
      players.filter(
        (player) => player.captain_eligible
      ).length,
    [players]
  );


  const loadSeasonData = useCallback(
    async (seasonId: string) => {
      if (!seasonId) {
        setSeasonTeams([]);
        setPlayers([]);
        resetBuilder();
        setLoading(false);
        return;
      }


      setLoading(true);
      setMessage("");
      resetBuilder();


      const [seasonTeamsResult, playersResult] =
        await Promise.all([
          supabase
            .from("season_teams")
            .select(
              `
                team_id,
                teams (
                  id,
                  name
                )
              `
            )
            .eq("season_id", seasonId)
            .eq("is_active", true),


          supabase.rpc(
            "get_team_generator_players",
            {
              p_season_id: seasonId,
            }
          ),
        ]);


      const errors: string[] = [];


      if (seasonTeamsResult.error) {
        errors.push(
          `Unable to load participating teams: ${seasonTeamsResult.error.message}`
        );
      } else {
        const rows =
          (seasonTeamsResult.data ??
            []) as unknown as SeasonTeamRow[];


        const loadedTeams = rows
          .map((row) => {
            if (Array.isArray(row.teams)) {
              return row.teams[0] ?? null;
            }


            return row.teams;
          })
          .filter(
            (team): team is Team => Boolean(team)
          );


        setSeasonTeams(loadedTeams);
      }


      if (playersResult.error) {
        errors.push(
          `Unable to load generator players: ${playersResult.error.message}`
        );
      } else {
        const loadedPlayers =
          (playersResult.data ??
            []) as GeneratorPlayer[];


        setPlayers(
          loadedPlayers.map(
            (player: GeneratorPlayer) => ({
              ...player,
              total_weekends: Number(
                player.total_weekends
              ),
              response_count: Number(
                player.response_count
              ),
              available_count: Number(
                player.available_count
              ),
              tentative_count: Number(
                player.tentative_count
              ),
              unavailable_count: Number(
                player.unavailable_count
              ),
              weighted_availability_percentage:
                Number(
                  player.weighted_availability_percentage
                ),
            })
          )
        );
      }


      if (errors.length > 0) {
        setMessage(errors.join(" "));
      }


      setLoading(false);
    },
    []
  );


  const loadInitialData = useCallback(async () => {
    if (!profile || !isAdmin) {
      setLoading(false);
      return;
    }


    setLoading(true);
    setMessage("");


    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, active")
      .order("active", {
        ascending: false,
      });


    if (error) {
      setMessage(
        `Unable to load seasons: ${error.message}`
      );
      setLoading(false);
      return;
    }


    const loadedSeasons = (data ?? []) as Season[];
    setSeasons(loadedSeasons);


    const defaultSeason =
      loadedSeasons.find(
        (season) => season.active
      ) ??
      loadedSeasons[0] ??
      null;


    if (defaultSeason) {
      setSelectedSeasonId(defaultSeason.id);
      await loadSeasonData(defaultSeason.id);
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadSeasonData, profile]);


  useEffect(() => {
    if (loadingProfile) {
      return;
    }


    void loadInitialData();
  }, [loadingProfile, loadInitialData]);


  function resetBuilder() {
    setGeneratedOptions([]);
    setActiveOptionIndex(0);
    setCustomAssignments({});
    setCustomBuilderStarted(false);
  }


  async function handleSeasonChange(
    seasonId: string
  ) {
    setSelectedSeasonId(seasonId);
    await loadSeasonData(seasonId);
  }


  function handleModeChange(mode: BuilderMode) {
    setBuilderMode(mode);
    setMessage("");
  }


  function generateTeams() {
    setMessage("");


    if (!selectedSeasonId) {
      setMessage("Please select a season.");
      return;
    }


    if (seasonTeams.length < 2) {
      setMessage(
        "Please configure at least two participating teams in Season Setup."
      );
      return;
    }


    if (players.length < seasonTeams.length) {
      setMessage(
        "There are not enough active players for the configured teams."
      );
      return;
    }


    setGenerating(true);
    setGeneratedOptions([]);
    setActiveOptionIndex(0);


    const candidates: CandidateResult[] = [];


    for (
      let attempt = 0;
      attempt < GENERATION_ATTEMPTS;
      attempt += 1
    ) {
      candidates.push(
        createCandidate(players, seasonTeams)
      );
    }


    candidates.sort(
      (first, second) =>
        first.score - second.score
    );


    const uniqueCandidates: CandidateResult[] = [];
    const seenSignatures = new Set<string>();


    for (const candidate of candidates) {
      const signature = createCandidateSignature(
        candidate.teams
      );


      if (seenSignatures.has(signature)) {
        continue;
      }


      seenSignatures.add(signature);
      uniqueCandidates.push(candidate);


      if (
        uniqueCandidates.length ===
        NUMBER_OF_OPTIONS
      ) {
        break;
      }
    }


    if (uniqueCandidates.length === 0) {
      setMessage(
        "Unable to generate balanced team options."
      );
      setGenerating(false);
      return;
    }


    const bestRawScore =
      uniqueCandidates[0].score;


    const worstRawScore =
      uniqueCandidates[
        uniqueCandidates.length - 1
      ].score;


    const options: GeneratedOption[] =
      uniqueCandidates.map(
        (candidate, index) => ({
          id: `option-${index + 1}`,
          teams: candidate.teams,
          rawScore: candidate.score,
          fairnessPercentage:
            convertScoreToFairnessPercentage(
              candidate.score,
              bestRawScore,
              worstRawScore
            ),
        })
      );


    setGeneratedOptions(options);
    setActiveOptionIndex(0);


    setMessage(
      `${options.length} balanced team options generated. Option 1 is recommended.`
    );


    setGenerating(false);
  }


  function startBlankCustomBuilder() {
    if (seasonTeams.length < 2) {
      setMessage(
        "Configure at least two participating teams first."
      );
      return;
    }


    const blankAssignments: CustomAssignments = {};


    players.forEach((player) => {
      blankAssignments[player.member_id] = "";
    });


    setCustomAssignments(blankAssignments);
    setCustomBuilderStarted(true);
    setMessage(
      "Custom builder started. Assign each player to a team."
    );
  }


  function copyBalancedOptionToCustom() {
    if (!activeOption) {
      setMessage(
        "Generate and select a balanced option first."
      );
      return;
    }


    const copiedAssignments: CustomAssignments = {};


    activeOption.teams.forEach(
      (generatedTeam) => {
        generatedTeam.players.forEach(
          (player) => {
            copiedAssignments[player.member_id] =
              generatedTeam.team.id;
          }
        );
      }
    );


    setCustomAssignments(copiedAssignments);
    setCustomBuilderStarted(true);
    setBuilderMode("custom");


    setMessage(
      `Option ${
        activeOptionIndex + 1
      } was copied into the Custom Team Builder. You can now override any assignment.`
    );
  }


async function saveFinalTeams() {
  setMessage("");


  if (!selectedSeasonId) {
    setMessage("Please select a season.");
    return;
  }


  const teamsToSave =
    builderMode === "balanced"
      ? activeOption?.teams ?? []
      : customTeams;


  if (teamsToSave.length === 0) {
    setMessage(
      builderMode === "balanced"
        ? "Generate and select a balanced option first."
        : "Start the Custom Team Builder first."
    );
    return;
  }


  if (
    builderMode === "custom" &&
    unassignedPlayers.length > 0
  ) {
    setMessage(
      `Please assign all players first. ${unassignedPlayers.length} players are still unassigned.`
    );
    return;
  }


  const assignments = teamsToSave.flatMap(
    (generatedTeam) =>
      generatedTeam.players.map((player) => ({
        team_id: generatedTeam.team.id,
        member_id: player.member_id,


        // Captains can be selected later on
        // the Manage Team Rosters page.
        is_captain: false,
      }))
  );


  if (assignments.length === 0) {
    setMessage("There are no player assignments to save.");
    return;
  }


  const confirmed = window.confirm(
    `Save these final teams?\n\nThis will replace the current saved team assignments for ${selectedSeason?.name ?? "this season"}.`
  );


  if (!confirmed) {
    return;
  }


  setSavingFinalTeams(true);


  const { data, error } = await supabase.rpc(
    "save_generated_team_assignments",
    {
      p_season_id: selectedSeasonId,
      p_assignments: assignments,
    }
  );


  if (error) {
    setMessage(
      `Unable to save final teams: ${error.message}`
    );
    setSavingFinalTeams(false);
    return;
  }


  setMessage(
    `${Number(data)} player assignments were saved successfully. You can now review them in Manage Team Rosters.`
  );


  setSavingFinalTeams(false);
}




  function updateCustomAssignment(
    memberId: string,
    teamId: string
  ) {
    setCustomAssignments((current) => ({
      ...current,
      [memberId]: teamId,
    }));


    setMessage("");
  }


  function autoDistributeUnassignedPlayers() {
    if (!customBuilderStarted) {
      return;
    }


    const nextAssignments = {
      ...customAssignments,
    };


    const currentCounts = new Map<string, number>();


    seasonTeams.forEach((team) => {
      currentCounts.set(team.id, 0);
    });


    Object.values(nextAssignments).forEach(
      (teamId) => {
        if (!teamId) {
          return;
        }


        currentCounts.set(
          teamId,
          (currentCounts.get(teamId) ?? 0) + 1
        );
      }
    );


    unassignedPlayers.forEach((player) => {
      const smallestTeam = [...seasonTeams].sort(
        (first, second) =>
          (currentCounts.get(first.id) ?? 0) -
          (currentCounts.get(second.id) ?? 0)
      )[0];


      if (!smallestTeam) {
        return;
      }


      nextAssignments[player.member_id] =
        smallestTeam.id;


      currentCounts.set(
        smallestTeam.id,
        (currentCounts.get(smallestTeam.id) ??
          0) + 1
      );
    });


    setCustomAssignments(nextAssignments);
    setMessage(
      "Unassigned players were distributed by team size. You can still override them."
    );
  }


  if (loadingProfile) {
    return (
      <PageMessage message="Checking account…" />
    );
  }


  if (!profile) {
    return (
      <AccessMessage
        title="Sign in required"
        message="Sign in to access the team generator."
      />
    );
  }


  if (!isAdmin) {
    return (
      <AccessMessage
        title="Admin access required"
        message="Only an Admin can generate seasonal team assignments."
      />
    );
  }


  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>


        <div className="mt-6">
          <h1 className="text-3xl font-bold text-blue-900">
            ⚖️ Fair Team Builder
          </h1>


          <p className="mt-2 max-w-3xl text-slate-600">
            Generate three balanced options or manually
            build your own teams without being restricted
            by the recommended fairness score.
          </p>
        </div>


        {message && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}


        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Season
            </span>


            <select
              value={selectedSeasonId}
              onChange={(event) =>
                void handleSeasonChange(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"
            >
              <option value="">
                Select a season
              </option>


              {seasons.map((season) => (
                <option
                  key={season.id}
                  value={season.id}
                >
                  {season.name}
                  {season.active
                    ? " — Active"
                    : ""}
                </option>
              ))}
            </select>
          </label>


          {selectedSeason && (
            <p className="mt-3 text-sm text-slate-600">
              Building teams for{" "}
              <strong>
                {selectedSeason.name}
              </strong>
              .
            </p>
          )}
        </section>


        {loading ? (
          <p className="mt-8 text-slate-600">
            Loading team-builder data…
          </p>
        ) : (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Players"
                value={players.length.toString()}
                detail="Active approved members"
              />


              <SummaryCard
                label="Teams"
                value={seasonTeams.length.toString()}
                detail="Configured for season"
              />


              <SummaryCard
                label="Wicketkeepers"
                value={availableWicketkeepers.toString()}
                detail={`Recommended minimum: ${seasonTeams.length}`}
              />


              <SummaryCard
                label="Captain eligible"
                value={availableCaptains.toString()}
                detail={`Recommended minimum: ${seasonTeams.length}`}
              />
            </section>


            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              <WarningCard
                title="Incomplete availability"
                count={
                  playersWithIncompleteAvailability.length
                }
                message={
                  playersWithIncompleteAvailability.length >
                  0
                    ? `${playersWithIncompleteAvailability.length} players have not answered every weekend. Missing responses count as unavailable.`
                    : "Every player has answered all active weekend dates."
                }
                good={
                  playersWithIncompleteAvailability.length ===
                  0
                }
              />


              <WarningCard
                title="Missing skill ratings"
                count={
                  playersWithMissingRatings.length
                }
                message={
                  playersWithMissingRatings.length >
                  0
                    ? `${playersWithMissingRatings.length} players have incomplete ratings. Missing ratings temporarily use 3 out of 5.`
                    : "Every player has batting, bowling, and fielding ratings."
                }
                good={
                  playersWithMissingRatings.length ===
                  0
                }
              />
            </section>
            <section className="mt-7">
              <h2 className="text-lg font-semibold text-slate-900">
                Choose how you want to build the teams
              </h2>


              <div className="mt-3 grid max-w-2xl grid-cols-2 rounded-xl bg-slate-200 p-1">
                <button
                  type="button"
                  onClick={() =>
                    handleModeChange("balanced")
                  }
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                    builderMode === "balanced"
                      ? "bg-white text-blue-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  ⚖️ Balanced Options
                </button>


                <button
                  type="button"
                  onClick={() =>
                    handleModeChange("custom")
                  }
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                    builderMode === "custom"
                      ? "bg-white text-blue-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  ✋ Build My Own
                </button>
              </div>
            </section>


            {builderMode === "balanced" && (
              <BalancedBuilder
                generating={generating}
                generatedOptions={generatedOptions}
                activeOptionIndex={activeOptionIndex}
                activeOption={activeOption}
                generatedTeams={generatedTeams}
                canGenerate={
                  seasonTeams.length >= 2 &&
                  players.length > 0
                }
                onGenerate={generateTeams}
                onSelectOption={setActiveOptionIndex}
                onCopyToCustom={
                  copyBalancedOptionToCustom
                }
                savingFinalTeams={savingFinalTeams}
                onSaveFinalTeams={() =>
                  void saveFinalTeams()
                }
              />
            )}


            {builderMode === "custom" && (
              <CustomBuilder
                started={customBuilderStarted}
                players={players}
                seasonTeams={seasonTeams}
                assignments={customAssignments}
                customTeams={customTeams}
                unassignedPlayers={unassignedPlayers}
                fairnessPercentage={
                  customFairnessPercentage
                }
                rawScore={customRawScore}
                canStart={
                  seasonTeams.length >= 2 &&
                  players.length > 0
                }
                hasBalancedOption={Boolean(
                  activeOption
                )}
                onStartBlank={
                  startBlankCustomBuilder
                }
                onCopyBalanced={
                  copyBalancedOptionToCustom
                }
                onAssignmentChange={
                  updateCustomAssignment
                }
                onAutoDistribute={
                  autoDistributeUnassignedPlayers
                }
                savingFinalTeams={savingFinalTeams}
                onSaveFinalTeams={() =>
                  void saveFinalTeams()
                }
              />
            )}


            <div className="mt-8">
              <Link
                href="/season-setup"
                className="inline-block rounded-lg border border-blue-900 px-6 py-3 font-medium text-blue-900"
              >
                Review Season Setup
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}


function BalancedBuilder({
  generating,
  generatedOptions,
  activeOptionIndex,
  activeOption,
  generatedTeams,
  canGenerate,
  onGenerate,
  onSelectOption,
  onCopyToCustom,
  savingFinalTeams,
  onSaveFinalTeams,
}: {
  generating: boolean;
  generatedOptions: GeneratedOption[];
  activeOptionIndex: number;
  activeOption: GeneratedOption | null;
  generatedTeams: GeneratedTeam[];
  canGenerate: boolean;
  onGenerate: () => void;
  onSelectOption: (index: number) => void;
  onCopyToCustom: () => void;
  savingFinalTeams: boolean;
  onSaveFinalTeams: () => void;
}) {
  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-xl font-semibold text-blue-950">
          ⚖️ Balanced Options
        </h2>


        <p className="mt-2 text-sm text-blue-800">
          The system will create three strong combinations
          using skill ratings, availability, wicketkeepers,
          captains, and equal team sizes.
        </p>


        <button
          type="button"
          disabled={generating || !canGenerate}
          onClick={onGenerate}
          className="mt-5 rounded-lg bg-blue-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating
            ? "Generating 3 Options…"
            : generatedOptions.length > 0
              ? "Generate New Options"
              : "Generate 3 Balanced Options"}
        </button>
      </div>


      {generatedOptions.length > 0 &&
        activeOption && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Generated Team Options
            </h2>


            <p className="mt-1 text-sm text-slate-600">
              Compare the three options and select the one
              you prefer.
            </p>


            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {generatedOptions.map(
                (option, index) => {
                  const isActive =
                    index === activeOptionIndex;


                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        onSelectOption(index)
                      }
                      className={`rounded-xl border p-5 text-left transition ${
                        isActive
                          ? "border-blue-800 bg-blue-900 text-white shadow-lg"
                          : "border-blue-100 bg-blue-50 text-blue-950 hover:border-blue-500 hover:bg-blue-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">
                          Option {index + 1}
                        </p>


                        {index === 0 && (
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            Recommended
                          </span>
                        )}
                      </div>


                      <p className="mt-4 text-xl font-bold">
                        {generatedOptions.every(
                          (item) =>
                            item.rawScore ===
                            generatedOptions[0].rawScore
                        )
                          ? "Equal balance"
                          : `${option.fairnessPercentage}%`}
                      </p>

                      <p
                        className={`mt-1 text-xs ${
                          isActive
                            ? "text-blue-100"
                            : "text-slate-600"
                        }`}
                      >
                        {generatedOptions.every(
                          (item) =>
                            item.rawScore ===
                            generatedOptions[0].rawScore
                        )
                          ? "Same calculated fairness"
                          : "Relative balance score"}
                      </p>
                    </button>
                  );
                }
              )}
            </div>


            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">
                    Selected option
                  </p>


                  <h3 className="mt-1 text-2xl font-bold text-blue-950">
                    Option {activeOptionIndex + 1}
                  </h3>


                  <p className="mt-1 text-sm text-blue-800">
                    This option is balanced using the player
                    information currently available.
                  </p>
                </div>


                <div className="rounded-xl bg-white px-5 py-3 text-center shadow-sm">
                  <p className="text-sm text-slate-600">
                    Fairness
                  </p>


                  <p className="mt-1 text-2xl font-bold text-blue-900">
                    {generatedOptions.every(
                      (item) =>
                        item.rawScore ===
                        generatedOptions[0].rawScore
                    )
                      ? "Equal balance"
                      : `${activeOption.fairnessPercentage}%`}
                  </p>

                  <p className="mt-1 text-xs font-medium text-green-700">
                    {generatedOptions.every(
                      (item) =>
                        item.rawScore ===
                        generatedOptions[0].rawScore
                    )
                      ? "All three options score the same"
                      : getFairnessLabel(
                          activeOption.fairnessPercentage
                        )}
                  </p>
                </div>
              </div>


              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onCopyToCustom}
                  className="rounded-lg border border-blue-900 bg-white px-5 py-3 text-sm font-medium text-blue-900 hover:bg-blue-100"
                >
                  Copy This Option to Custom Builder
                </button>

                <button
                  type="button"
                  disabled={savingFinalTeams}
                  onClick={onSaveFinalTeams}
                  className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingFinalTeams
                    ? "Saving Final Teams…"
                    : "💾 Save This as Final Teams"}
                </button>
              </div>
            </div>


            <TeamCards teams={generatedTeams} />


            <BalanceTable
              generatedTeams={generatedTeams}
            />
          </section>
        )}
    </section>
  );
}


function CustomBuilder({
  started,
  players,
  seasonTeams,
  assignments,
  customTeams,
  unassignedPlayers,
  fairnessPercentage,
  rawScore: _rawScore,
  canStart,
  hasBalancedOption,
  onStartBlank,
  onCopyBalanced,
  onAssignmentChange,
  onAutoDistribute,
  savingFinalTeams,
  onSaveFinalTeams,
}: {
  started: boolean;
  players: GeneratorPlayer[];
  seasonTeams: Team[];
  assignments: CustomAssignments;
  customTeams: GeneratedTeam[];
  unassignedPlayers: GeneratorPlayer[];
  fairnessPercentage: number;
  rawScore: number;
  canStart: boolean;
  hasBalancedOption: boolean;
  onStartBlank: () => void;
  onCopyBalanced: () => void;
  onAssignmentChange: (
    memberId: string,
    teamId: string
  ) => void;
  onAutoDistribute: () => void;
  savingFinalTeams: boolean;
  onSaveFinalTeams: () => void;
}) {
  return (
    <section className="mt-6">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
        <h2 className="text-xl font-semibold text-violet-950">
          ✋ Custom Team Builder
        </h2>


        <p className="mt-2 text-sm text-violet-800">
          Assign players however you prefer. The balance
          score is only informational and will not prevent
          you from using your chosen teams.
        </p>


        {!started && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canStart}
              onClick={onStartBlank}
              className="rounded-lg bg-violet-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Start With Blank Teams
            </button>


            {hasBalancedOption && (
              <button
                type="button"
                onClick={onCopyBalanced}
                className="rounded-lg border border-violet-900 bg-white px-5 py-3 font-medium text-violet-900"
              >
                Start From Selected Balanced Option
              </button>
            )}
          </div>
        )}
      </div>


      {started && (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Assigned"
              value={(
                players.length -
                unassignedPlayers.length
              ).toString()}
              detail={`Out of ${players.length} players`}
            />

            <SummaryCard
              label="Unassigned"
              value={unassignedPlayers.length.toString()}
              detail="Players still needing a team"
            />

            <SummaryCard
              label="Fairness"
              value={`${fairnessPercentage}%`}
              detail="Informational only"
            />
          </section>


          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Assign Players
              </h2>


              <p className="mt-1 text-sm text-slate-600">
                Choose any team for each player. Select
                Unassigned to remove a player from a team.
              </p>
            </div>


            {unassignedPlayers.length > 0 && (
              <button
                type="button"
                onClick={onAutoDistribute}
                className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-medium text-blue-900"
              >
                Auto-Distribute Unassigned
              </button>
            )}
          </div>


          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {players.map((player) => (
                <div
                  key={player.member_id}
                  className="grid gap-4 p-4 sm:grid-cols-[1fr_240px] sm:items-center"
                >
                  <div>
                    <p className="font-semibold text-blue-900">
                      {player.player_name}
                    </p>


                    <p className="mt-1 text-xs text-slate-500">
                      {player.primary_role ??
                        "Role not set"}{" "}
                      • Batting{" "}
                      {getRating(
                        player.batting_rating
                      )}{" "}
                      • Bowling{" "}
                      {getRating(
                        player.bowling_rating
                      )}{" "}
                      • Fielding{" "}
                      {getRating(
                        player.fielding_rating
                      )}
                    </p>


                    <p className="mt-1 text-xs text-slate-500">
                      Availability{" "}
                      {player.weighted_availability_percentage.toFixed(
                        1
                      )}
                      %
                      {player.can_keep_wickets
                        ? " • 🧤 Wicketkeeper"
                        : ""}
                      {player.captain_eligible
                        ? " • ⭐ Captain eligible"
                        : ""}
                    </p>
                  </div>


                  <select
                    value={
                      assignments[player.member_id] ??
                      ""
                    }
                    onChange={(event) =>
                      onAssignmentChange(
                        player.member_id,
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3"
                  >
                    <option value="">
                      Unassigned
                    </option>


                    {seasonTeams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                      >
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>


          {unassignedPlayers.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>
                {unassignedPlayers.length}
              </strong>{" "}
              players are still unassigned. You can keep
              working, but all players should normally be
              assigned before saving final teams.
            </div>
          )}


          <TeamCards teams={customTeams} />


          <BalanceTable
            generatedTeams={customTeams}
          />


          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
            <h3 className="font-semibold text-green-900">
              Ready to finalize your teams?
            </h3>

            <p className="mt-1 text-sm text-green-800">
              Saving will replace the current team assignments
              for this season. The custom fairness score will
              not prevent you from saving.
            </p>

            <button
              type="button"
              disabled={
                savingFinalTeams ||
                unassignedPlayers.length > 0
              }
              onClick={onSaveFinalTeams}
              className="mt-4 rounded-lg bg-green-700 px-6 py-3 font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingFinalTeams
                ? "Saving Final Teams…"
                : "💾 Save Custom Teams"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}


function createCandidate(
  players: GeneratorPlayer[],
  teams: Team[]
): CandidateResult {
  const shuffledPlayers = shuffle([...players]).sort(
    (first, second) =>
      playerAssignmentPriority(second) -
      playerAssignmentPriority(first)
  );


  const generatedTeams: GeneratedTeam[] =
    createEmptyGeneratedTeams(teams);


  shuffledPlayers.forEach((player) => {
    const teamChoices = shuffle([
      ...generatedTeams,
    ]);


    let bestTeam = teamChoices[0];
    let bestScore = Number.POSITIVE_INFINITY;


    teamChoices.forEach((candidateTeam) => {
      const temporaryTeams =
        generatedTeams.map((team) =>
          team.team.id ===
          candidateTeam.team.id
            ? addPlayerToTeam(team, player)
            : team
        );


      const score =
        calculateFairnessScore(temporaryTeams);


      if (score < bestScore) {
        bestScore = score;
        bestTeam = candidateTeam;
      }
    });


    const teamIndex = generatedTeams.findIndex(
      (team) =>
        team.team.id === bestTeam.team.id
    );


    generatedTeams[teamIndex] =
      addPlayerToTeam(
        generatedTeams[teamIndex],
        player
      );
  });


  return {
    teams: generatedTeams,
    score:
      calculateFairnessScore(generatedTeams),
  };
}


function createEmptyGeneratedTeams(
  teams: Team[]
): GeneratedTeam[] {
  return teams.map((team) => ({
    team,
    players: [],
    battingTotal: 0,
    bowlingTotal: 0,
    fieldingTotal: 0,
    availabilityTotal: 0,
    wicketkeeperCount: 0,
    captainEligibleCount: 0,
  }));
}


function buildTeamsFromCustomAssignments(
  players: GeneratorPlayer[],
  teams: Team[],
  assignments: CustomAssignments
) {
  let generatedTeams =
    createEmptyGeneratedTeams(teams);


  players.forEach((player) => {
    const assignedTeamId =
      assignments[player.member_id];


    if (!assignedTeamId) {
      return;
    }


    const teamIndex = generatedTeams.findIndex(
      (generatedTeam) =>
        generatedTeam.team.id === assignedTeamId
    );


    if (teamIndex === -1) {
      return;
    }


    generatedTeams[teamIndex] =
      addPlayerToTeam(
        generatedTeams[teamIndex],
        player
      );
  });


  return generatedTeams;
}


function addPlayerToTeam(
  team: GeneratedTeam,
  player: GeneratorPlayer
): GeneratedTeam {
  return {
    ...team,
    players: [...team.players, player],
    battingTotal:
      team.battingTotal +
      getRating(player.batting_rating),
    bowlingTotal:
      team.bowlingTotal +
      getRating(player.bowling_rating),
    fieldingTotal:
      team.fieldingTotal +
      getRating(player.fielding_rating),
    availabilityTotal:
      team.availabilityTotal +
      player.weighted_availability_percentage,
    wicketkeeperCount:
      team.wicketkeeperCount +
      (player.can_keep_wickets ? 1 : 0),
    captainEligibleCount:
      team.captainEligibleCount +
      (player.captain_eligible ? 1 : 0),
  };
}


function calculateFairnessScore(
  teams: GeneratedTeam[]
) {
  if (teams.length === 0) {
    return Number.POSITIVE_INFINITY;
  }


  const sizePenalty =
    spread(
      teams.map(
        (team) => team.players.length
      )
    ) * 40;


  const battingPenalty =
    spread(
      teams.map(
        (team) => team.battingTotal
      )
    ) * 5;


  const bowlingPenalty =
    spread(
      teams.map(
        (team) => team.bowlingTotal
      )
    ) * 5;


  const fieldingPenalty =
    spread(
      teams.map(
        (team) => team.fieldingTotal
      )
    ) * 3;


  const availabilityPenalty =
    spread(
      teams.map((team) =>
        getAverageAvailability(team)
      )
    ) * 2;


  const wicketkeeperPenalty =
    teams.filter(
      (team) => team.wicketkeeperCount === 0
    ).length * 60;


  const captainPenalty =
    teams.filter(
      (team) =>
        team.captainEligibleCount === 0
    ).length * 40;


  return (
    sizePenalty +
    battingPenalty +
    bowlingPenalty +
    fieldingPenalty +
    availabilityPenalty +
    wicketkeeperPenalty +
    captainPenalty
  );
}


function createCandidateSignature(
  teams: GeneratedTeam[]
) {
  return teams
    .map((generatedTeam) => {
      const playerIds =
        generatedTeam.players
          .map(
            (player) => player.member_id
          )
          .sort()
          .join(",");


      return `${generatedTeam.team.id}:${playerIds}`;
    })
    .sort()
    .join("|");
}


function convertScoreToFairnessPercentage(
  score: number,
  bestScore: number,
  worstScore: number
) {
  if (bestScore === worstScore) {
    return 100;
  }


  const relativePosition =
    (score - bestScore) /
    (worstScore - bestScore);


  const percentage =
    100 - relativePosition * 12;


  return Math.max(
    0,
    Math.min(100, Math.round(percentage))
  );
}


function convertRawScoreToStandaloneFairness(
  score: number,
  teams: GeneratedTeam[],
  playerCount: number
) {
  if (playerCount === 0 || teams.length === 0) {
    return 0;
  }


  const emptyTeamCount = teams.filter(
    (team) => team.players.length === 0
  ).length;


  if (emptyTeamCount > 0) {
    return Math.max(
      0,
      Math.round(70 - emptyTeamCount * 20)
    );
  }


  const normalizedPenalty =
    score /
    Math.max(1, playerCount * teams.length);


  return Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - normalizedPenalty)
    )
  );
}


function playerAssignmentPriority(
  player: GeneratorPlayer
) {
  return (
    getRating(player.batting_rating) +
    getRating(player.bowling_rating) +
    getRating(player.fielding_rating) +
    (player.can_keep_wickets ? 8 : 0) +
    (player.captain_eligible ? 5 : 0)
  );
}


function getRating(rating: number | null) {
  return rating ?? DEFAULT_RATING;
}


function getAverageAvailability(
  team: GeneratedTeam
) {
  if (team.players.length === 0) {
    return 0;
  }


  return (
    team.availabilityTotal /
    team.players.length
  );
}


function getAverageRating(
  total: number,
  playerCount: number
) {
  if (playerCount === 0) {
    return 0;
  }


  return total / playerCount;
}


function spread(values: number[]) {
  if (values.length === 0) {
    return 0;
  }


  return (
    Math.max(...values) -
    Math.min(...values)
  );
}


function shuffle<T>(items: T[]) {
  const copy = [...items];


  for (
    let index = copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );


    [copy[index], copy[randomIndex]] = [
      copy[randomIndex],
      copy[index],
    ];
  }


  return copy;
}


function getFairnessLabel(
  percentage: number
) {
  if (percentage >= 97) {
    return "Excellent balance";
  }


  if (percentage >= 93) {
    return "Very good balance";
  }


  if (percentage >= 88) {
    return "Good balance";
  }


  if (percentage >= 80) {
    return "Acceptable balance";
  }


  return "Needs review";
}


function TeamCards({
  teams,
}: {
  teams: GeneratedTeam[];
}) {
  return (
    <div
      className={`mt-6 grid gap-6 ${
        teams.length === 2
          ? "lg:grid-cols-2"
          : teams.length === 3
            ? "xl:grid-cols-3"
            : "sm:grid-cols-2 xl:grid-cols-4"
      }`}
    >
      {teams.map((generatedTeam) => (
        <GeneratedTeamCard
          key={generatedTeam.team.id}
          generatedTeam={generatedTeam}
        />
      ))}
    </div>
  );
}


function GeneratedTeamCard({
  generatedTeam,
}: {
  generatedTeam: GeneratedTeam;
}) {
  const averageAvailability =
    getAverageAvailability(generatedTeam);


  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-950 to-blue-700 p-5 text-white">
        <p className="text-sm text-blue-100">
          Team roster
        </p>


        <h3 className="mt-1 text-2xl font-bold">
          🏏 {generatedTeam.team.name}
        </h3>
      </div>


      <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-4 text-sm">
        <Metric
          label="Players"
          value={generatedTeam.players.length.toString()}
        />


        <Metric
          label="Availability"
          value={`${averageAvailability.toFixed(
            1
          )}%`}
        />


        <Metric
          label="Batting"
          value={getAverageRating(
            generatedTeam.battingTotal,
            generatedTeam.players.length
          ).toFixed(2)}
        />


        <Metric
          label="Bowling"
          value={getAverageRating(
            generatedTeam.bowlingTotal,
            generatedTeam.players.length
          ).toFixed(2)}
        />


        <Metric
          label="Fielding"
          value={getAverageRating(
            generatedTeam.fieldingTotal,
            generatedTeam.players.length
          ).toFixed(2)}
        />


        <Metric
          label="Keepers"
          value={generatedTeam.wicketkeeperCount.toString()}
        />
      </div>


      {generatedTeam.players.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">
          No players assigned.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {generatedTeam.players.map((player) => (
            <div
              key={player.member_id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium text-blue-900">
                  {player.player_name}
                </p>


                <p className="mt-0.5 text-xs text-slate-500">
                  {player.primary_role ??
                    "Role not set"}
                </p>
              </div>


              <div className="text-right text-xs text-slate-500">
                <p>
                  {player.weighted_availability_percentage.toFixed(
                    1
                  )}
                  % available
                </p>


                <p className="mt-1">
                  {player.can_keep_wickets
                    ? "🧤 "
                    : ""}
                  {player.captain_eligible
                    ? "⭐"
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}


function BalanceTable({
  generatedTeams,
}: {
  generatedTeams: GeneratedTeam[];
}) {
  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              Metric
            </th>


            {generatedTeams.map((team) => (
              <th
                key={team.team.id}
                className="px-4 py-3 text-left font-semibold text-slate-700"
              >
                {team.team.name}
              </th>
            ))}
          </tr>
        </thead>


        <tbody className="divide-y divide-slate-100">
          <BalanceRow
            label="Players"
            values={generatedTeams.map(
              (team) =>
                team.players.length.toString()
            )}
          />


          <BalanceRow
            label="Avg batting"
            values={generatedTeams.map(
              (team) =>
                getAverageRating(
                  team.battingTotal,
                  team.players.length
                ).toFixed(2)
            )}
          />


          <BalanceRow
            label="Avg bowling"
            values={generatedTeams.map(
              (team) =>
                getAverageRating(
                  team.bowlingTotal,
                  team.players.length
                ).toFixed(2)
            )}
          />


          <BalanceRow
            label="Avg fielding"
            values={generatedTeams.map(
              (team) =>
                getAverageRating(
                  team.fieldingTotal,
                  team.players.length
                ).toFixed(2)
            )}
          />


          <BalanceRow
            label="Avg availability"
            values={generatedTeams.map(
              (team) =>
                `${getAverageAvailability(
                  team
                ).toFixed(1)}%`
            )}
          />


          <BalanceRow
            label="Wicketkeepers"
            values={generatedTeams.map(
              (team) =>
                team.wicketkeeperCount.toString()
            )}
          />


          <BalanceRow
            label="Captain eligible"
            values={generatedTeams.map(
              (team) =>
                team.captainEligibleCount.toString()
            )}
          />
        </tbody>
      </table>
    </div>
  );
}


function BalanceRow({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-700">
        {label}
      </td>


      {values.map((value, index) => (
        <td
          key={`${label}-${index}`}
          className="px-4 py-3 text-slate-600"
        >
          {value}
        </td>
      ))}
    </tr>
  );
}


function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">
        {label}
      </p>


      <p className="mt-1 font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}


function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">
        {label}
      </p>


      <p className="mt-2 text-3xl font-bold text-blue-900">
        {value}
      </p>


      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </article>
  );
}


function WarningCard({
  title,
  count,
  message,
  good,
}: {
  title: string;
  count: number;
  message: string;
  good: boolean;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        good
          ? "border-green-200 bg-green-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className={`font-semibold ${
              good
                ? "text-green-900"
                : "text-amber-900"
            }`}
          >
            {title}
          </h3>


          <p
            className={`mt-1 text-sm ${
              good
                ? "text-green-800"
                : "text-amber-800"
            }`}
          >
            {message}
          </p>
        </div>


        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            good
              ? "bg-green-200 text-green-900"
              : "bg-amber-200 text-amber-900"
          }`}
        >
          {count}
        </span>
      </div>
    </article>
  );
}


function PageMessage({
  message,
}: {
  message: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-slate-600">
          {message}
        </p>
      </div>
    </main>
  );
}


function AccessMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>


        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🔐</div>


          <h1 className="mt-4 text-2xl font-bold text-blue-900">
            {title}
          </h1>


          <p className="mt-2 text-slate-600">
            {message}
          </p>
        </section>
      </div>
    </main>
  );
}
