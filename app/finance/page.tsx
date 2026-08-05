"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { uploadFinanceReceipt } from "@/lib/supabase/financeStorage";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type TransactionType = "Income" | "Expense";

type Category =
  | "Registration Fee"
  | "Birthday"
  | "Ground Fee"
  | "Food"
  | "Equipment"
  | "Jerseys"
  | "Trophies"
  | "Sponsorship"
  | "Donation"
  | "Other";

type Team = {
  id: string;
  name: string;
};

type Season = {
  id: string;
  name: string;
};

type FinanceTransaction = {
  id: string;
  transaction_type: TransactionType;
  category: Category;
  amount: number;
  transaction_date: string;
  paid_by_or_received_from: string | null;
  description: string;
  receipt_url: string | null;
  team_id: string | null;
  season_id: string | null;
  split_expense: boolean;
  participant_count: number | null;
  amount_per_person: number | null;
};

type TransactionForm = {
  transaction_type: TransactionType;
  category: Category;
  amount: string;
  transaction_date: string;
  paid_by_or_received_from: string;
  description: string;
  team_id: string;
  receipt_url: string;
  split_expense: boolean;
  participant_count: string;
};

const categories: Category[] = [
  "Registration Fee",
  "Birthday",
  "Ground Fee",
  "Food",
  "Equipment",
  "Jerseys",
  "Trophies",
  "Sponsorship",
  "Donation",
  "Other",
];

function createInitialForm(): TransactionForm {
  return {
    transaction_type: "Expense",
    category: "Other",
    amount: "",
    transaction_date: getTodayDate(),
    paid_by_or_received_from: "",
    description: "",
    team_id: "",
    receipt_url: "",
    split_expense: false,
    participant_count: "",
  };
}

export default function FinancePage() {
  const { profile, loadingProfile } =
    useCurrentProfile();

  const canManageFinance =
    profile?.appRole === "Admin" ||
    profile?.appRole === "Treasurer";

  const [transactions, setTransactions] = useState<
    FinanceTransaction[]
  >([]);

  const [teams, setTeams] = useState<Team[]>([]);

  const [activeSeason, setActiveSeason] =
    useState<Season | null>(null);

  const [form, setForm] =
    useState<TransactionForm>(createInitialForm);

  const [
    editingTransactionId,
    setEditingTransactionId,
  ] = useState<string | null>(null);

  const [receiptFile, setReceiptFile] =
    useState<File | null>(null);

  const [receiptInputKey, setReceiptInputKey] =
    useState(0);

  const [filterType, setFilterType] = useState<
    "All" | TransactionType
  >("All");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [
    deletingTransactionId,
    setDeletingTransactionId,
  ] = useState<string | null>(null);

  const [message, setMessage] = useState("");

  async function loadFinanceData() {
    if (!profile) {
      setTransactions([]);
      setTeams([]);
      setActiveSeason(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const [
      transactionsResult,
      teamsResult,
      seasonResult,
    ] = await Promise.all([
      supabase
        .from("finance_transactions")
        .select(
          `
            id,
            transaction_type,
            category,
            amount,
            transaction_date,
            paid_by_or_received_from,
            description,
            receipt_url,
            team_id,
            season_id,
            split_expense,
            participant_count,
            amount_per_person
          `
        )
        .order("transaction_date", {
          ascending: false,
        }),

      supabase
        .from("teams")
        .select("id, name")
        .order("name"),

      supabase
        .from("seasons")
        .select("id, name")
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const errors: string[] = [];

    if (transactionsResult.error) {
      errors.push(
        `Unable to load transactions: ${transactionsResult.error.message}`
      );
    } else {
      setTransactions(
        (transactionsResult.data ??
          []) as FinanceTransaction[]
      );
    }

    if (teamsResult.error) {
      errors.push(
        `Unable to load teams: ${teamsResult.error.message}`
      );
    } else {
      setTeams(teamsResult.data ?? []);
    }

    if (seasonResult.error) {
      errors.push(
        `Unable to load active season: ${seasonResult.error.message}`
      );
    } else {
      setActiveSeason(seasonResult.data);
    }

    if (errors.length > 0) {
      setMessage(errors.join(" "));
    }

    setLoading(false);
  }

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadFinanceData();
  }, [loadingProfile, profile?.userId]);

  function resetForm() {
    setForm(createInitialForm());
    setEditingTransactionId(null);
    setReceiptFile(null);

    setReceiptInputKey(
      (current) => current + 1
    );
  }

  function startEditing(
    transaction: FinanceTransaction
  ) {
    if (!canManageFinance) {
      return;
    }

    setEditingTransactionId(transaction.id);

    setForm({
      transaction_type:
        transaction.transaction_type,
      category: transaction.category,
      amount: transaction.amount.toString(),
      transaction_date:
        transaction.transaction_date,
      paid_by_or_received_from:
        transaction.paid_by_or_received_from ??
        "",
      description: transaction.description,
      team_id: transaction.team_id ?? "",
      receipt_url:
        transaction.receipt_url ?? "",
      split_expense:
        transaction.split_expense ?? false,
      participant_count:
        transaction.participant_count?.toString() ??
        "",
    });

    setReceiptFile(null);

    setReceiptInputKey(
      (current) => current + 1
    );

    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    resetForm();
    setMessage("");
  }

  function handleReceiptSelection(
    file: File | null
  ) {
    if (!file) {
      setReceiptFile(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage(
        "Please upload a JPG, PNG, WebP, or PDF receipt."
      );

      setReceiptFile(null);

      setReceiptInputKey(
        (current) => current + 1
      );

      return;
    }

    const maximumSize = 10 * 1024 * 1024;

    if (file.size > maximumSize) {
      setMessage(
        "Receipt file must be smaller than 10 MB."
      );

      setReceiptFile(null);

      setReceiptInputKey(
        (current) => current + 1
      );

      return;
    }

    setReceiptFile(file);
    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (!canManageFinance) {
      setMessage(
        "Only a Treasurer or Admin can manage finance transactions."
      );
      return;
    }

    const amount = Number(form.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setMessage(
        "Please enter a valid amount greater than zero."
      );
      return;
    }

    if (!form.transaction_date) {
      setMessage(
        "Transaction date is required."
      );
      return;
    }

    if (!form.description.trim()) {
      setMessage("Description is required.");
      return;
    }

    let participantCount: number | null =
      null;

    let amountPerPerson: number | null =
      null;

    const shouldSplitExpense =
      form.transaction_type === "Expense" &&
      form.split_expense;

    if (shouldSplitExpense) {
      participantCount = Number(
        form.participant_count
      );

      if (
        !Number.isInteger(participantCount) ||
        participantCount <= 0
      ) {
        setMessage(
          "Please enter a valid number of participants greater than zero."
        );
        return;
      }

      amountPerPerson =
        Math.round(
          (amount / participantCount) * 100
        ) / 100;
    }

    setSubmitting(true);

    let receiptUrl = form.receipt_url;

    try {
      if (receiptFile) {
        receiptUrl =
          await uploadFinanceReceipt(
            receiptFile
          );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown receipt upload error";

      setMessage(
        `Unable to upload receipt: ${errorMessage}`
      );

      setSubmitting(false);
      return;
    }

    const transactionData = {
      transaction_type:
        form.transaction_type,
      category: form.category,
      amount,
      transaction_date:
        form.transaction_date,
      paid_by_or_received_from:
        form.paid_by_or_received_from.trim() ||
        null,
      description:
        form.description.trim(),
      receipt_url: receiptUrl || null,
      team_id: form.team_id || null,
      season_id: activeSeason?.id ?? null,
      split_expense:
        shouldSplitExpense,
      participant_count:
        shouldSplitExpense
          ? participantCount
          : null,
      amount_per_person:
        shouldSplitExpense
          ? amountPerPerson
          : null,
    };

    const { error } = editingTransactionId
      ? await supabase
          .from("finance_transactions")
          .update(transactionData)
          .eq(
            "id",
            editingTransactionId
          )
      : await supabase
          .from("finance_transactions")
          .insert(transactionData);

    if (error) {
      setMessage(
        `Unable to ${
          editingTransactionId
            ? "update"
            : "add"
        } transaction: ${error.message}`
      );

      setSubmitting(false);
      return;
    }

    const successMessage =
      editingTransactionId
        ? "Transaction updated successfully."
        : "Transaction added successfully.";

    resetForm();

    await loadFinanceData();

    setMessage(successMessage);
    setSubmitting(false);
  }

  async function deleteTransaction(
    transaction: FinanceTransaction
  ) {
    if (!canManageFinance) {
      setMessage(
        "Only a Treasurer or Admin can delete transactions."
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${transaction.description}"?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingTransactionId(
      transaction.id
    );

    setMessage("");

    const { error } = await supabase
      .from("finance_transactions")
      .delete()
      .eq("id", transaction.id);

    if (error) {
      setMessage(
        `Unable to delete transaction: ${error.message}`
      );

      setDeletingTransactionId(null);
      return;
    }

    if (
      editingTransactionId ===
      transaction.id
    ) {
      resetForm();
    }

    await loadFinanceData();

    setMessage(
      "Transaction deleted successfully."
    );

    setDeletingTransactionId(null);
  }

  function getTeamName(
    teamId: string | null
  ) {
    if (!teamId) {
      return "Entire Starz Club";
    }

    return (
      teams.find(
        (team) => team.id === teamId
      )?.name ?? "Unknown team"
    );
  }

  const totals = useMemo(() => {
    const income = transactions
      .filter(
        (transaction) =>
          transaction.transaction_type ===
          "Income"
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(transaction.amount),
        0
      );

    const expenses = transactions
      .filter(
        (transaction) =>
          transaction.transaction_type ===
          "Expense"
      )
      .reduce(
        (total, transaction) =>
          total +
          Number(transaction.amount),
        0
      );

    return {
      income,
      expenses,
      balance: income - expenses,
    };
  }, [transactions]);

  const filteredTransactions =
    useMemo(() => {
      const searchText = search
        .trim()
        .toLowerCase();

      return transactions.filter(
        (transaction) => {
          const matchesType =
            filterType === "All" ||
            transaction.transaction_type ===
              filterType;

          const personText =
            transaction.paid_by_or_received_from?.toLowerCase() ??
            "";

          const matchesSearch =
            !searchText ||
            transaction.category
              .toLowerCase()
              .includes(searchText) ||
            transaction.description
              .toLowerCase()
              .includes(searchText) ||
            personText.includes(searchText) ||
            getTeamName(
              transaction.team_id
            )
              .toLowerCase()
              .includes(searchText);

          return (
            matchesType && matchesSearch
          );
        }
      );
    }, [
      transactions,
      filterType,
      search,
      teams,
    ]);

  const liveSplitAmount =
    form.transaction_type === "Expense" &&
    form.split_expense &&
    Number(form.amount) > 0 &&
    Number(form.participant_count) > 0
      ? Number(form.amount) /
        Number(form.participant_count)
      : null;

  if (loadingProfile) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-slate-600">
            Checking account…
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>

          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">🔐</div>

            <h1 className="mt-4 text-2xl font-bold text-blue-900">
              Sign in required
            </h1>

            <p className="mt-2 text-slate-600">
              You must sign in to view club finance
              records.
            </p>

            <Link
              href="/auth"
              className="mt-6 inline-block rounded-lg bg-blue-900 px-5 py-3 font-medium text-white"
            >
              Sign In
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-blue-900">
          💰 Club Finances
        </h1>

        <p className="mt-3 text-slate-600">
          Track income, expenses, shared
          costs, and receipts
          {activeSeason
            ? ` for ${activeSeason.name}`
            : ""}
          .
        </p>

        {!canManageFinance && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Finance records are read-only for your
            account. Only a Treasurer or Admin can add,
            edit, or delete transactions.
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Total Income"
            amount={totals.income}
            className="bg-green-50 text-green-800"
          />

          <SummaryCard
            title="Total Expenses"
            amount={totals.expenses}
            className="bg-red-50 text-red-800"
          />

          <SummaryCard
            title="Current Balance"
            amount={totals.balance}
            className={
              totals.balance >= 0
                ? "bg-blue-50 text-blue-900"
                : "bg-amber-50 text-amber-900"
            }
          />
        </div>

        {message && (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </p>
        )}

        <div
          className={`mt-8 grid gap-8 lg:items-start ${
            canManageFinance
              ? "lg:grid-cols-[1.15fr_0.85fr]"
              : "grid-cols-1"
          }`}
        >
          {/* TRANSACTION HISTORY */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Transaction history
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                  Review club income, expenses, shared
                  amounts, and receipts.
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900">
                {
                  filteredTransactions.length
                }{" "}
                {filteredTransactions.length ===
                1
                  ? "transaction"
                  : "transactions"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="search"
                placeholder="Search category, description, person, or team"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
              />

              <select
                value={filterType}
                onChange={(event) =>
                  setFilterType(
                    event.target.value as
                      | "All"
                      | TransactionType
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-3"
              >
                <option value="All">
                  All
                </option>

                <option value="Income">
                  Income
                </option>

                <option value="Expense">
                  Expenses
                </option>
              </select>
            </div>

            {loading && (
              <p className="mt-6 text-slate-600">
                Loading transactions…
              </p>
            )}

            {!loading &&
              transactions.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <div className="text-4xl">
                    🧾
                  </div>

                  <p className="mt-3 font-medium text-slate-800">
                    No transactions have been added yet.
                  </p>
                </div>
              )}

            {!loading &&
              transactions.length > 0 &&
              filteredTransactions.length ===
                0 && (
                <p className="mt-6 text-slate-600">
                  No transactions match your filters.
                </p>
              )}

            <div className="mt-6 space-y-4">
              {filteredTransactions.map(
                (transaction) => (
                  <article
                    key={transaction.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <TransactionBadge
                            type={
                              transaction.transaction_type
                            }
                          />

                          <span className="text-sm font-medium text-slate-500">
                            {
                              transaction.category
                            }
                          </span>

                          <span className="text-sm text-slate-500">
                            {getTeamName(
                              transaction.team_id
                            )}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-blue-900">
                          {
                            transaction.description
                          }
                        </h3>

                        <p className="mt-2 text-sm text-slate-600">
                          {formatDate(
                            transaction.transaction_date
                          )}
                        </p>

                        {transaction.paid_by_or_received_from && (
                          <p className="mt-2 text-sm text-slate-700">
                            <strong>
                              {transaction.transaction_type ===
                              "Expense"
                                ? "Paid by:"
                                : "Received from:"}
                            </strong>{" "}
                            {
                              transaction.paid_by_or_received_from
                            }
                          </p>
                        )}

                        {transaction.receipt_url && (
                          <a
                            href={
                              transaction.receipt_url
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                          >
                            View receipt →
                          </a>
                        )}
                      </div>

                      <div className="sm:min-w-48 sm:text-right">
                        <p
                          className={`text-2xl font-bold ${
                            transaction.transaction_type ===
                            "Income"
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {transaction.transaction_type ===
                          "Income"
                            ? "+"
                            : "-"}
                          {formatCurrency(
                            Number(
                              transaction.amount
                            )
                          )}
                        </p>

                        {transaction.split_expense &&
                          transaction.participant_count &&
                          transaction.amount_per_person !==
                            null && (
                            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-left text-sm text-blue-900 sm:text-right">
                              <p>
                                Split between{" "}
                                <strong>
                                  {
                                    transaction.participant_count
                                  }
                                </strong>{" "}
                                people
                              </p>

                              <p className="mt-1">
                                Each person pays{" "}
                                <strong>
                                  {formatCurrency(
                                    Number(
                                      transaction.amount_per_person
                                    )
                                  )}
                                </strong>
                              </p>
                            </div>
                          )}

                        {canManageFinance && (
                          <div className="mt-4 flex gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                startEditing(
                                  transaction
                                )
                              }
                              className="rounded-lg border border-blue-900 px-4 py-2 text-sm font-medium text-blue-900"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={
                                deletingTransactionId ===
                                transaction.id
                              }
                              onClick={() =>
                                void deleteTransaction(
                                  transaction
                                )
                              }
                              className="rounded-lg border border-red-600 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
                            >
                              {deletingTransactionId ===
                              transaction.id
                                ? "Deleting…"
                                : "Delete"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>

          {/* ADD / EDIT TRANSACTION */}
          {canManageFinance && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
              <h2 className="text-xl font-semibold text-blue-900">
                {editingTransactionId
                  ? "Edit transaction"
                  : "Add transaction"}
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Add income or an expense and upload
                supporting receipts.
              </p>

              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                Before uploading a receipt, crop or hide
                card numbers, addresses, phone numbers,
                and other sensitive information.
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-5 grid gap-4"
              >
                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Transaction type *
                  </span>

                  <select
                    value={
                      form.transaction_type
                    }
                    onChange={(event) => {
                      const transactionType =
                        event.target
                          .value as TransactionType;

                      setForm({
                        ...form,
                        transaction_type:
                          transactionType,
                        split_expense:
                          transactionType ===
                          "Expense"
                            ? form.split_expense
                            : false,
                        participant_count:
                          transactionType ===
                          "Expense"
                            ? form.participant_count
                            : "",
                      });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="Income">
                      Income
                    </option>

                    <option value="Expense">
                      Expense
                    </option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Category *
                  </span>

                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category:
                          event.target
                            .value as Category,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {categories.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-medium text-slate-700">
                      Amount *
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amount:
                            event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label>
                    <span className="text-sm font-medium text-slate-700">
                      Date *
                    </span>

                    <input
                      type="date"
                      required
                      value={
                        form.transaction_date
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          transaction_date:
                            event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>

                {form.transaction_type ===
                  "Expense" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={
                          form.split_expense
                        }
                        onChange={(event) =>
                          setForm({
                            ...form,
                            split_expense:
                              event.target
                                .checked,
                            participant_count:
                              event.target.checked
                                ? form.participant_count
                                : "",
                          })
                        }
                      />

                      <span className="text-sm font-medium text-slate-700">
                        Split this expense between
                        attendees
                      </span>
                    </label>

                    {form.split_expense && (
                      <div className="mt-4">
                        <label>
                          <span className="text-sm font-medium text-slate-700">
                            Number of participants *
                          </span>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={
                              form.participant_count
                            }
                            onChange={(event) =>
                              setForm({
                                ...form,
                                participant_count:
                                  event.target
                                    .value,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>

                        {liveSplitAmount !==
                          null && (
                          <div className="mt-4 rounded-lg bg-blue-50 p-4 text-blue-900">
                            <p className="text-sm">
                              Amount per person
                            </p>

                            <p className="mt-1 text-2xl font-bold">
                              {formatCurrency(
                                liveSplitAmount
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Paid by / received from
                  </span>

                  <input
                    type="text"
                    value={
                      form.paid_by_or_received_from
                    }
                    onChange={(event) =>
                      setForm({
                        ...form,
                        paid_by_or_received_from:
                          event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Team
                  </span>

                  <select
                    value={form.team_id}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        team_id:
                          event.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">
                      Entire Starz Club
                    </option>

                    {teams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                      >
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Description *
                  </span>

                  <textarea
                    rows={4}
                    required
                    value={form.description}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        description:
                          event.target.value,
                      })
                    }
                    placeholder="Describe the income or expense"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-700">
                    Receipt
                  </span>

                  <input
                    key={receiptInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(event) =>
                      handleReceiptSelection(
                        event.target.files?.[0] ??
                          null
                      )
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />

                  <p className="mt-1 text-xs text-slate-500">
                    JPG, PNG, WebP, or PDF. Maximum
                    10 MB.
                  </p>

                  {receiptFile && (
                    <p className="mt-2 text-sm text-slate-600">
                      Selected:{" "}
                      {receiptFile.name}
                    </p>
                  )}

                  {!receiptFile &&
                    form.receipt_url && (
                      <a
                        href={
                          form.receipt_url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline"
                      >
                        View current receipt →
                      </a>
                    )}
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-900 px-5 py-3 font-medium text-white disabled:opacity-60"
                  >
                    {submitting
                      ? editingTransactionId
                        ? "Updating…"
                        : "Adding…"
                      : editingTransactionId
                        ? "Update Transaction"
                        : "Add Transaction"}
                  </button>

                  {editingTransactionId && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={submitting}
                      className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  amount,
  className,
}: {
  title: string;
  amount: number;
  className: string;
}) {
  return (
    <article
      className={`rounded-xl border border-slate-200 p-5 shadow-sm ${className}`}
    >
      <p className="text-sm font-medium">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {formatCurrency(amount)}
      </p>
    </article>
  );
}

function TransactionBadge({
  type,
}: {
  type: TransactionType;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        type === "Income"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {type === "Income"
        ? "↓ Income"
        : "↑ Expense"}
    </span>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  ).format(
    new Date(`${value}T00:00:00`)
  );
}

function getTodayDate() {
  const date = new Date();

  const localDate = new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60_000
  );

  return localDate
    .toISOString()
    .slice(0, 10);
}
