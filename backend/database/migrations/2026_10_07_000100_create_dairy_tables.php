<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Dairy domain: customers, pricing, milk entries, bills and payments.
 * Every table is tenant-scoped; tenant_id leads every composite index.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name', 150);
            $table->string('mobile', 20)->nullable();
            $table->string('whatsapp', 20)->nullable();
            $table->string('address', 500)->nullable();
            $table->string('village', 120)->nullable();
            $table->decimal('opening_balance', 12, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->index(['tenant_id', 'mobile']);
            $table->index(['tenant_id', 'status', 'name']);
            $table->index(['tenant_id', 'village']);
        });

        Schema::create('milk_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->date('effective_from');
            $table->enum('session', ['morning', 'evening', 'both'])->default('both');
            $table->enum('method', ['fixed', 'fat'])->default('fixed');
            $table->decimal('rate', 10, 2)->nullable();
            $table->decimal('fat_rate', 10, 4)->nullable();
            $table->decimal('min_rate', 10, 2)->nullable();
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'effective_from', 'session']);
            $table->index(['tenant_id', 'session', 'effective_from']);
        });

        Schema::create('bill_sequences', function (Blueprint $table) {
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_number')->default(0);
            $table->primary(['tenant_id', 'year']);
        });

        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->string('bill_no', 30);
            $table->date('bill_date');
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('total_qty', 12, 2)->default(0);
            $table->decimal('avg_fat', 5, 2)->nullable();
            $table->unsignedInteger('entry_count')->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('previous_balance', 12, 2)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('net_payable', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->decimal('outstanding', 12, 2)->default(0);
            $table->enum('status', ['draft', 'generated', 'pending', 'partially_paid', 'paid', 'cancelled'])->default('generated');
            // 1 while the bill is live, NULL once cancelled: lets the unique key below
            // block duplicate bills for a period while still allowing re-billing after cancel.
            $table->boolean('period_lock')->nullable()->default(true);
            $table->foreignId('carried_forward_to_id')->nullable()->constrained('bills')->nullOnDelete();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancel_reason', 255)->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'bill_no']);
            $table->unique(['tenant_id', 'customer_id', 'period_start', 'period_lock'], 'bills_customer_period_unique');
            $table->index(['tenant_id', 'customer_id', 'period_start']);
            $table->index(['tenant_id', 'status', 'bill_date']);
            $table->index(['tenant_id', 'period_start', 'period_end']);
        });

        Schema::create('milk_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->date('entry_date');
            $table->enum('session', ['morning', 'evening']);
            $table->decimal('quantity', 10, 2);
            $table->decimal('fat', 4, 2)->nullable();
            $table->decimal('snf', 4, 2)->nullable();
            $table->decimal('rate', 10, 2);
            $table->enum('rate_source', ['auto', 'manual'])->default('auto');
            $table->string('pricing_method', 20)->default('fixed');
            $table->decimal('amount', 12, 2);
            $table->string('notes', 255)->nullable();
            $table->foreignId('bill_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('client_uuid')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'customer_id', 'entry_date', 'session'], 'milk_entries_one_per_session');
            $table->unique(['tenant_id', 'client_uuid']);
            $table->index(['tenant_id', 'entry_date', 'session']);
            $table->index(['tenant_id', 'customer_id', 'entry_date']);
            $table->index(['tenant_id', 'bill_id']);
        });

        Schema::create('bill_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bill_id')->constrained()->cascadeOnDelete();
            $table->foreignId('milk_entry_id')->nullable()->constrained()->nullOnDelete();
            $table->date('entry_date');
            $table->enum('session', ['morning', 'evening']);
            $table->decimal('quantity', 10, 2);
            $table->decimal('fat', 4, 2)->nullable();
            $table->decimal('rate', 10, 2);
            $table->decimal('amount', 12, 2);

            $table->index(['bill_id', 'entry_date']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->restrictOnDelete();
            $table->foreignId('bill_id')->nullable()->constrained()->nullOnDelete();
            $table->date('payment_date');
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['cash', 'upi', 'bank_transfer', 'other'])->default('cash');
            $table->string('reference', 100)->nullable();
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'customer_id', 'payment_date']);
            $table->index(['tenant_id', 'payment_date']);
            $table->index(['tenant_id', 'bill_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
        Schema::dropIfExists('bill_items');
        Schema::dropIfExists('milk_entries');
        Schema::dropIfExists('bills');
        Schema::dropIfExists('bill_sequences');
        Schema::dropIfExists('milk_prices');
        Schema::dropIfExists('customers');
    }
};
