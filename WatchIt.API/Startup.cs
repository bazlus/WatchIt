namespace WatchIt.API;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using WatchIt.Application.Common;
using WatchIt.Application.Extensions;
using WatchIt.Domain;
using WatchIt.Domain.Models;

public class Startup
{
    public Startup(IConfiguration configuration)
    {
        Configuration = configuration;
    }

    public IConfiguration Configuration { get; }

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();
        services.AddAutoMapper(typeof(AutoMapperProfile));
        services.AddApplication();
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo { Title = "WatchIt.API", Version = "v1" });
        });

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseSqlServer(Configuration.GetConnectionString("WatchIt"));
        });

        services.AddIdentity<ApplicationUser, IdentityRole>(_ =>
            {

            })
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "WatchIt.API v1"));
        }

        app.UseHttpsRedirection();
        app.UseRouting();
        app.UseExceptionHandler();
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
        });

        var serviceScopeFactory = app.ApplicationServices.GetRequiredService<IServiceScopeFactory>();
        using var serviceScope = serviceScopeFactory.CreateScope();
        var dbContext = serviceScope.ServiceProvider.GetService<ApplicationDbContext>();
        dbContext?.Database.EnsureCreated();
    }
}

