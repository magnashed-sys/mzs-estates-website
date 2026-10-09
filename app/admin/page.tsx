417
418
419
420
421
422
423
424
425
426
427
428
429
430
431
432
433
434
435
436
437
438
439
440
441
442
443
444
445
446
447
448
449
450
451
452
453
454
455
456
457
458
459
460
461
462
463
464
465
466
467
468
469
470
471
472
473
474
475
476
477
478
479
480
481
482
483
484
485
486
487
488
489
490
491
492
493
494
495
496
497
498
499
500
501
502
503
504
505
506
507
508
509
510
511
512
513
514
515
516
517
518
519
520
521
522
523
524
525
526
527
528
529
530
531
532
533
534
535
536
537
538
539
540
541
542
                  </p>
                )}

                {request.status === "pending" && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "28px",
                  }}>
                    <button
                      type="button"
                      disabled={processingId !== null}
                      onClick={() =>
                        setReviewingRequestId(request.id)
                      }
                      style={{
                        padding: "13px 22px",
                        background: "#d5c09a",
                        border: "1px solid #d5c09a",
                        color: "#0b0b0a",
                        cursor: "pointer",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      {processingId === request.id
                        ? "Processing..."
                        : "Review & select projects"}
                    </button>

                    <button
                      type="button"
                      disabled={processingId !== null}
                      onClick={() =>
                        handleReview(request, "declined")
                      }
                      style={{
                        padding: "13px 22px",
                        background: "transparent",
                        border: "1px solid #665a45",
                        color: "#d5c09a",
                        cursor: "pointer",
                        fontSize: "10px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                )}
                {request.status === "approved" && !invitation && (
                  <div style={{ marginTop: 24 }}>
                    <button type="button" disabled={processingId !== null}
                      onClick={() => setReviewingRequestId(request.id)}
                      style={{ padding: "13px 22px", background: "transparent", border: "1px solid #d5c09a", color: "#d5c09a", cursor: "pointer", fontSize: 12, letterSpacing: ".08em" }}>
                      Project selection & invitation →
                    </button>
                  </div>
                )}
                {reviewingRequestId === request.id && (
                  <RequestProjectApproval
                    request={request}
                    onApproved={markRequestApproved}
                    onInvited={recordInvitation}
                    onClose={() => setReviewingRequestId(null)}
                  />
                )}
                {invitation && (
                  <p style={{ color: "#a9a398", fontSize: "12px", lineHeight: 1.7, marginTop: "24px" }}>
                    {invitation.status === "completed"
                      ? "Registration completed. Manage later access changes in Project Access Management."
                      : invitation.status === "sent"
                      ? "Invitation sent. Any approved access selection was attached when the invitation account was created."
                      : "This invitation requires administrator review before another attempt."}
                  </p>
                )}
              </article>
              );
            })}
          </div>
        )}
        <div className="admin-section-heading" style={{ marginTop: "72px" }}>
          <div><p className="eyebrow">Relationships</p><h2>Account management</h2></div>
          <span>{activeCount} active / {relationships.length} accounts</span>
        </div>

        {relationships.length === 0 ? (
          <p className="admin-empty">No client or partner accounts found.</p>
        ) : (
          <div className="admin-requests">
            {relationships.map((account) => (
              <article className="admin-request" key={account.id}>
                <div className="admin-request-top">
                  <div>
                    <h3>{account.full_name || "Unnamed relationship"}</h3>
                    <p>{account.email}</p>
                  </div>
                  <span className="admin-status">{account.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="admin-request-details">
                  <p>Role: {account.role === "partner" ? "Partner" : "Client"}</p>
                  <p>Created: {new Date(account.created_at).toLocaleDateString("en-GB")}</p>
                </div>
                <div style={{ marginTop: "28px" }}>
                  <button type="button" disabled={processingId !== null}
                    onClick={() => handleAccountStatus(account, !account.is_active)}
                    style={{ padding: "13px 22px", background: account.is_active ? "transparent" : "#d5c09a", border: "1px solid #d5c09a", color: account.is_active ? "#d5c09a" : "#0b0b0a", cursor: "pointer", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    {processingId === account.id ? "Processing..." : account.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        </>}
      </section>

      <footer className="admin-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
